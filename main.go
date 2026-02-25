// Terminal User Interface (TUI) Kanban board.
// It uses the Bubble Tea architectural pattern (Model-View-Update).
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

// Configuration
var storageFile = "kanban.json"

// Status represents the column/stage of a task.
type status int

const (
	todo status = iota
	inProgress
	review
	done
)

var (
	columnStyle  = lipgloss.NewStyle().Padding(0, 1).Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("240"))
	focusedStyle = columnStyle.BorderForeground(lipgloss.Color("250"))
	inputStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Margin(1, 0)
	tagStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("35")).Italic(true)
)

// Task Model
type task struct {
	TitleStr  string                   `json:"title"`
	Content   string                   `json:"body"`
	Tags      string                   `json:"tags"`
	Status    status                   `json:"status"`
	LastMoved time.Time                `json:"last_moved"`
	TimeSpent map[status]time.Duration `json:"time_spent"`
}

func (t task) Title() string       { return t.TitleStr }
func (t task) FilterValue() string { return t.TitleStr + " " + t.Tags }
func (t task) Description() string {
	if t.Tags != "" {
		return fmt.Sprintf("%s\n%s", t.Content, tagStyle.Render("#"+t.Tags))
	}
	return t.Content
}

// Task Delegate
type delegateStyles struct {
	list.DefaultItemStyles
	NormalTag   lipgloss.Style
	SelectedTag lipgloss.Style
}

type taskDelegate struct {
	height int
	width  int
	styles delegateStyles
}

func (d taskDelegate) Height() int                               { return d.height }
func (d taskDelegate) Spacing() int                              { return 1 }
func (d taskDelegate) Update(msg tea.Msg, m *list.Model) tea.Cmd { return nil }
func (d taskDelegate) Render(w io.Writer, l list.Model, index int, item list.Item) {
	t, ok := item.(task)
	if !ok {
		return
	}

	// Dynamic word wrapping for description
	wrapWidth := max(d.width-2, 15)
	descStyle := lipgloss.NewStyle().Width(wrapWidth)

	var title, description, tags string
	if index == l.Index() {
		title = d.styles.SelectedTitle.Render(t.TitleStr)
		description = d.styles.SelectedDesc.Render(descStyle.Render(t.Content))
		if t.Tags != "" {
			tags = d.styles.SelectedDesc.Render(tagStyle.Render("#" + t.Tags))
		}
	} else {
		title = d.styles.NormalTitle.Render(t.TitleStr)
		description = d.styles.NormalDesc.Render(descStyle.Render(t.Content))
		if t.Tags != "" {
			tags = d.styles.NormalDesc.Render(tagStyle.Render("#" + t.Tags))
		}
	}

	out := lipgloss.JoinVertical(lipgloss.Left, title, description, tags)
	fmt.Fprint(w, out)
}

// Application Model
type Model struct {
	lists    []list.Model
	focused  status
	input    textinput.Model
	delegate taskDelegate
	editing  bool
	isEdit   bool
	step     int
	tempTask task
	width    int
	height   int
	loaded   bool
}

func NewModel() Model {
	ti := textinput.New()
	ti.Focus()

	defaultStyles := list.NewDefaultItemStyles()
	defaultStyles.NormalTitle = defaultStyles.NormalTitle.Foreground(lipgloss.Color("255"))
	defaultStyles.SelectedTitle = defaultStyles.SelectedTitle.Foreground(lipgloss.Color("255")).Bold(true)
	defaultStyles.NormalDesc = defaultStyles.NormalDesc.Foreground(lipgloss.Color("252"))
	defaultStyles.SelectedDesc = defaultStyles.SelectedDesc.Foreground(lipgloss.Color("252"))

	styles := delegateStyles{
		DefaultItemStyles: defaultStyles,
	}

	delegate := taskDelegate{
		height: 4,
		styles: styles,
	}

	m := Model{
		lists:    make([]list.Model, 4),
		input:    ti,
		delegate: delegate,
	}

	cols := []string{"To-do", "In Progress", "Review", "Done"}
	for i := range m.lists {
		m.lists[i] = list.New([]list.Item{}, m.delegate, 0, 0)
		m.lists[i].Title = cols[i]
		m.lists[i].SetShowHelp(false)
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

// Update Logic
func (m Model) Init() tea.Cmd { return nil }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		if m.editing {
			return m.handleInput(msg)
		}

		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
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
				m.lists[m.focused].RemoveItem(m.lists[m.focused].Index())
				m.saveTasks()
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

	var cmd tea.Cmd
	m.lists[m.focused], cmd = m.lists[m.focused].Update(msg)
	return m, cmd
}

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

	// Track time spent in previous column
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

	// Swap items
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

	// Responsive task height: more tasks visible on smaller screens
	delegateHeight := 6
	if m.height < 25 {
		delegateHeight = 3
	} else if m.height < 40 {
		delegateHeight = 4
	} else if m.height < 55 {
		delegateHeight = 5
	}

	m.delegate.height = delegateHeight
	m.delegate.width = colWidth

	for i := range m.lists {
		m.lists[i].SetSize(colWidth, m.height-5)
		m.lists[i].SetDelegate(m.delegate)
	}
}

func (m Model) View() string {
	if !m.loaded {
		return "Initializing board..."
	}

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
	var cols []string

	switch numCols {
	case 1:
		cols = append(cols, focusedStyle.Width(colWidth).Render(m.lists[m.focused].View()))
	case 2:
		start := (int(m.focused) / 2) * 2
		for i := start; i < start+2 && i < len(m.lists); i++ {
			style := columnStyle.Width(colWidth)
			if status(i) == m.focused {
				style = focusedStyle.Width(colWidth)
			}
			cols = append(cols, style.Render(m.lists[i].View()))
		}
	default:
		for i := range m.lists {
			style := columnStyle.Width(colWidth)
			if status(i) == m.focused {
				style = focusedStyle.Width(colWidth)
			}
			cols = append(cols, style.Render(m.lists[i].View()))
		}
	}

	ui := lipgloss.JoinHorizontal(lipgloss.Top, cols...)

	help := "←/→: Switch • [/]: Move • J/K: Reorder • N: New • E: Edit • X: Delete • /: Filter • Q: Quit"
	if m.editing {
		labels := []string{"Title: ", "Description: ", "Tags: "}
		help = inputStyle.Render(labels[m.step]) + m.input.View() + " (Enter: Next, Esc: Cancel)"
	}

	return lipgloss.JoinVertical(lipgloss.Left, ui, help)
}

func main() {
	if _, err := tea.NewProgram(NewModel(), tea.WithAltScreen()).Run(); err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}
}
