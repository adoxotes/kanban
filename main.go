// Implements TUI Kanban board.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Config
var storageFile = "kanban.json"

// Status represents the current column/stage of a task.
type status int

const (
	todo status = iota
	inProgress
	review
	done
)

var (
	// Column styles
	columnStyle  = lipgloss.NewStyle().Padding(0, 1).Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("240"))
	focusedStyle = columnStyle.BorderForeground(lipgloss.Color("250"))

	// Text styles
	inputStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Margin(1, 0)
	tagStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("35")).Italic(true)

	// Help Popup Styles
	helpWindowStyle = lipgloss.NewStyle().
			Border(lipgloss.DoubleBorder()).
			BorderForeground(lipgloss.Color("63")).
			Padding(1, 2).
			Background(lipgloss.Color("235"))

	helpTitleStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("63")).Bold(true).Underline(true).MarginBottom(1)
	keyStyle       = lipgloss.NewStyle().Foreground(lipgloss.Color("169")).Bold(true)
)

// MARK: Task & Delegate Logic
// task defines the data structure for an individual Kanban item.
type task struct {
	TitleStr  string                   `json:"title"`
	Content   string                   `json:"body"`
	Tags      string                   `json:"tags"`
	Status    status                   `json:"status"`
	LastMoved time.Time                `json:"last_moved"`
	TimeSpent map[status]time.Duration `json:"time_spent"`
}

// Interfaces required by the bubbles/list package
func (t task) Title() string       { return t.TitleStr }
func (t task) FilterValue() string { return t.TitleStr + " " + t.Tags }
func (t task) Description() string {
	if t.Tags != "" {
		return fmt.Sprintf("%s\n%s", t.Content, tagStyle.Render("#"+t.Tags))
	}
	return t.Content
}

// taskDelegate handles how each task is rendered within the list.
type taskDelegate struct {
	height int
	width  int
	styles list.DefaultItemStyles
}

func (d taskDelegate) Height() int                               { return d.height }
func (d taskDelegate) Spacing() int                              { return 1 }
func (d taskDelegate) Update(msg tea.Msg, m *list.Model) tea.Cmd { return nil }
func (d taskDelegate) Render(w io.Writer, l list.Model, index int, item list.Item) {
	t, ok := item.(task)
	if !ok {
		return
	}

	// Calculate wrapping based on column width
	wrapWidth := max(d.width-2, 15)
	descStyle := lipgloss.NewStyle().Width(wrapWidth)

	var title, description, tags string
	if index == l.Index() {
		title = d.styles.SelectedTitle.Render(t.TitleStr)
		if t.Content != "" {
			description = d.styles.SelectedDesc.Render(descStyle.Render(t.Content))
		}
		if t.Tags != "" {
			tags = d.styles.SelectedDesc.Render(tagStyle.Render("#" + t.Tags))
		}
	} else {
		title = d.styles.NormalTitle.Render(t.TitleStr)
		if t.Content != "" {
			description = d.styles.NormalDesc.Render(descStyle.Render(t.Content))
		}
		if t.Tags != "" {
			tags = d.styles.NormalDesc.Render(tagStyle.Render("#" + t.Tags))
		}
	}

	var lines []string
	lines = append(lines, title)
	if description != "" {
		lines = append(lines, description)
	}
	if tags != "" {
		lines = append(lines, tags)
	}

	out := lipgloss.JoinVertical(lipgloss.Left, lines...)
	fmt.Fprint(w, out)
}

// MARK: Model
// Model holds the application state.
type Model struct {
	lists    []list.Model
	focused  status
	input    textinput.Model
	delegate taskDelegate
	editing  bool // True when user is typing a new/edited task
	deleting bool // True when confirming task deletion
	showHelp bool // True when the help popup is visible
	isEdit   bool // Distinguishes between 'new' and 'edit' mode
	step     int  // Tracking input steps (Title -> Desc -> Tags)
	tempTask task // Stores intermediate task data during creation
	width    int  // Terminal width
	height   int  // Terminal height
	loaded   bool // Flag to prevent rendering before window size is known
}

func NewModel() Model {
	ti := textinput.New()
	ti.Focus()

	defaultStyles := list.NewDefaultItemStyles()
	defaultStyles.NormalTitle = defaultStyles.NormalTitle.Foreground(lipgloss.Color("255"))
	defaultStyles.SelectedTitle = defaultStyles.SelectedTitle.Foreground(lipgloss.Color("255")).Bold(true)

	delegate := taskDelegate{height: 4, styles: defaultStyles}

	m := Model{
		lists:    make([]list.Model, 4),
		input:    ti,
		delegate: delegate,
	}

	cols := []string{"To-do", "In Progress", "Review", "Done"}
	for i := range m.lists {
		m.lists[i] = list.New([]list.Item{}, m.delegate, 0, 0)
		m.lists[i].Title = cols[i]
		m.lists[i].SetShowHelp(false) // We use our own help system
	}

	m.loadTasks()
	return m
}

// Persistence Logic
func (m *Model) saveTasks() {
	var all []task
	for _, l := range m.lists {
		for _, item := range l.Items() {
			all = append(all, item.(task))
		}
	}
	data, _ := json.Marshal(all)
	_ = os.WriteFile(storageFile, data, 0644)
}

func (m *Model) loadTasks() {
	data, err := os.ReadFile(storageFile)
	if err != nil {
		return
	}
	var saved []task
	if err := json.Unmarshal(data, &saved); err == nil {
		for _, t := range saved {
			if t.TimeSpent == nil {
				t.TimeSpent = make(map[status]time.Duration)
			}
			m.lists[t.Status].InsertItem(len(m.lists[t.Status].Items()), t)
		}
	}
}

// MARK: Update Logic
func (m Model) Init() tea.Cmd { return nil }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Help Popup Logic
	if m.showHelp {
		if msg, ok := msg.(tea.KeyMsg); ok {
			switch msg.String() {
			case "?", "q", "esc", "enter":
				m.showHelp = false
			}
		}
		return m, nil
	}

	// Deletion Confirmation Logic
	if m.deleting {
		if msg, ok := msg.(tea.KeyMsg); ok {
			switch msg.String() {
			case "y", "enter":
				if len(m.lists[m.focused].Items()) > 0 {
					m.lists[m.focused].RemoveItem(m.lists[m.focused].Index())
					m.saveTasks()
				}
				m.deleting = false
			case "n", "q", "esc":
				m.deleting = false
			}
		}
		return m, nil
	}

	// Filtering Logic
	// If the user is currently filtering a list, let the list component handle input.
	if m.loaded && m.lists[m.focused].FilterState() == list.Filtering {
		var cmd tea.Cmd
		m.lists[m.focused], cmd = m.lists[m.focused].Update(msg)
		return m, cmd
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.updateLayout()
		m.loaded = true

	case tea.KeyMsg:
		// Handle input if we are in task creation/edit mode
		if m.editing {
			return m.handleInput(msg)
		}

		// Main Navigation Keys
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "?":
			m.showHelp = true
			return m, nil
		case "n":
			m.editing, m.isEdit, m.step = true, false, 0
			m.tempTask = task{TimeSpent: make(map[status]time.Duration), LastMoved: time.Now(), Status: todo}
			m.input.Placeholder = "New Title..."
			m.input.Reset()
			return m, nil
		case "e":
			items := m.lists[m.focused].Items()
			if len(items) > 0 {
				m.editing, m.isEdit, m.step = true, true, 0
				m.tempTask = items[m.lists[m.focused].Index()].(task)
				m.input.SetValue(m.tempTask.TitleStr)
			}
			return m, nil
		case "x":
			if len(m.lists[m.focused].Items()) > 0 {
				m.deleting = true
			}
		case "right", "l", "tab":
			if m.focused < done {
				m.focused++
			}
		case "left", "h", "shift+tab":
			if m.focused > todo {
				m.focused--
			}
		case "enter", "]":
			m.moveTask(1)
		case "[":
			m.moveTask(-1)
		case "K":
			m.reorderTask(-1)
		case "J":
			m.reorderTask(1)
		}
	}

	// Update the active list (for scrolling and selection)
	var cmd tea.Cmd
	m.lists[m.focused], cmd = m.lists[m.focused].Update(msg)
	return m, cmd
}

// handleInput manages the multi-step form for creating or editing tasks.
func (m *Model) handleInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "enter":
		switch m.step {
		case 0:
			m.tempTask.TitleStr = m.input.Value()
			m.input.Reset()
			m.input.Placeholder = "Description..."
			m.input.SetValue(m.tempTask.Content)
			m.step = 1
		case 1:
			m.tempTask.Content = m.input.Value()
			m.input.Reset()
			m.input.Placeholder = "Tags..."
			m.input.SetValue(m.tempTask.Tags)
			m.step = 2
		case 2:
			m.tempTask.Tags = strings.ReplaceAll(m.input.Value(), " ", "")
			if m.isEdit {
				m.lists[m.focused].SetItem(m.lists[m.focused].Index(), m.tempTask)
			} else {
				m.lists[todo].InsertItem(len(m.lists[todo].Items()), m.tempTask)
			}
			m.saveTasks()
			m.editing = false
			m.input.Reset()
		}
		return m, nil
	case "esc":
		m.editing = false
		m.input.Reset()
		return m, nil
	}
	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m *Model) moveTask(dir int) {
	currItems := m.lists[m.focused].Items()
	if len(currItems) == 0 {
		return
	}
	target := m.focused + status(dir)
	if target < todo || target > done {
		return
	}
	idx := m.lists[m.focused].Index()
	t := currItems[idx].(task)
	t.TimeSpent[t.Status] += time.Since(t.LastMoved)
	t.Status = target
	t.LastMoved = time.Now()
	m.lists[m.focused].RemoveItem(idx)
	m.lists[target].InsertItem(len(m.lists[target].Items()), t)
	m.saveTasks()
}

func (m *Model) reorderTask(dir int) {
	idx := m.lists[m.focused].Index()
	items := m.lists[m.focused].Items()
	newIdx := idx + dir
	if newIdx < 0 || newIdx >= len(items) {
		return
	}
	item := items[idx]
	m.lists[m.focused].RemoveItem(idx)
	m.lists[m.focused].InsertItem(newIdx, item)
	m.lists[m.focused].Select(newIdx)
	m.saveTasks()
}

func (m *Model) updateLayout() {
	var numCols int
	switch {
	case m.width < 60:
		numCols = 1
	case m.width < 100:
		numCols = 2
	default:
		numCols = 4
	}
	colWidth := (m.width / numCols) - 4
	m.delegate.width = colWidth
	for i := range m.lists {
		m.lists[i].SetSize(colWidth, m.height-6)
		m.lists[i].SetDelegate(m.delegate)
	}
}

// MARK: View Logic
// helpView builds the content of the popup window.
func (m Model) helpView() string {
	content := lipgloss.JoinVertical(lipgloss.Left,
		helpTitleStyle.Render("KANBAN CONTROLS"),
		"",
		fmt.Sprintf("%s  : Navigation (Left/Right)", keyStyle.Render("h/l or ←/→")),
		fmt.Sprintf("%s  : Select Task (Up/Down)", keyStyle.Render("j/k or ↑/↓")),
		"",
		fmt.Sprintf("%s  : New Task", keyStyle.Render("n")),
		fmt.Sprintf("%s  : Edit Selected Task", keyStyle.Render("e")),
		fmt.Sprintf("%s  : Delete Selected Task", keyStyle.Render("x")),
		fmt.Sprintf("%s  : Move Task Between Columns", keyStyle.Render("[ / ]")),
		fmt.Sprintf("%s  : Reorder Task in List", keyStyle.Render("J / K")),
		"",
		fmt.Sprintf("%s  : Search/Filter List", keyStyle.Render("/")),
		fmt.Sprintf("%s  : Toggle Help", keyStyle.Render("?")),
		fmt.Sprintf("%s  : Quit", keyStyle.Render("q")),
	)
	return helpWindowStyle.Render(content)
}

func (m Model) View() string {
	if !m.loaded {
		return "Loading Board..."
	}

	// Calculate column layout based on screen width
	var numCols int
	switch {
	case m.width < 60:
		numCols = 1
	case m.width < 100:
		numCols = 2
	default:
		numCols = 4
	}

	colWidth := (m.width / numCols) - 2
	// Calculate visual column height (including borders)
	visualHeight := m.height - 5
	var cols []string

	// Responsive Column Selection
	switch numCols {
	case 1:
		cols = append(cols, focusedStyle.Width(colWidth).Height(visualHeight).Render(m.lists[m.focused].View()))
	case 2:
		start := (int(m.focused) / 2) * 2
		for i := start; i < start+2 && i < len(m.lists); i++ {
			style := columnStyle.Width(colWidth).Height(visualHeight)
			if status(i) == m.focused {
				style = focusedStyle.Width(colWidth).Height(visualHeight)
			}
			cols = append(cols, style.Render(m.lists[i].View()))
		}
	default:
		for i := range m.lists {
			style := columnStyle.Width(colWidth).Height(visualHeight)
			if status(i) == m.focused {
				style = focusedStyle.Width(colWidth).Height(visualHeight)
			}
			cols = append(cols, style.Render(m.lists[i].View()))
		}
	}

	// Assemble the UI
	board := lipgloss.JoinHorizontal(lipgloss.Top, cols...)

	footerHint := "Press '?' for help • 'q' to quit"
	if m.editing {
		labels := []string{"Title: ", "Description: ", "Tags: "}
		footerHint = inputStyle.Render(labels[m.step]) + m.input.View()
	} else if m.deleting {
		footerHint = inputStyle.Render("Delete this task? ") + keyStyle.Render("y") + "es / " + keyStyle.Render("n") + "o"
	}

	finalView := lipgloss.JoinVertical(lipgloss.Left, board, footerHint)

	// If showHelp is true, we use lipgloss.Place to put the popup in the exact center
	// of the terminal, regardless of the board's current size.
	if m.showHelp {
		return lipgloss.Place(
			m.width, m.height,
			lipgloss.Center, lipgloss.Center,
			m.helpView(),
		)
	}

	return finalView
}

// MARK: Entry
func main() {
	// tea.WithAltScreen() ensures the TUI uses the "Alternate Screen Buffer",
	// so it doesn't clutter your terminal scrollback history.
	p := tea.NewProgram(NewModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Startup Error: %v", err)
		os.Exit(1)
	}
}
