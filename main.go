// Package main implements a Terminal User Interface (TUI) Kanban board
// using the Bubble Tea framework. It features four columns, task persistence
// via JSON, real-time time tracking per column, and task filtering.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// storageFile defines where the Kanban data is persisted on disk.
const storageFile = "kanban.json"

// --- Styling ---
// We use Lipgloss to define the layout and colors of our TUI.
var (
	columnStyle  = lipgloss.NewStyle().Padding(1, 1).Border(lipgloss.RoundedBorder())
	focusedStyle = columnStyle.Copy().BorderForeground(lipgloss.Color("62")) // Purple border for active col
	inputStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Margin(1, 0)
	tagStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("35")).Italic(true)
)

// status represents the current column/stage of a task.
type status int

const (
	todo status = iota
	inProgress
	review
	done
)

// tickMsg is sent every second to force a UI refresh for the timers.
type tickMsg time.Time

// task represents a single Kanban item.
// It implements the list.Item interface required by the bubbles/list package.
type task struct {
	TitleStr  string                  `json:"title"`
	Body      string                  `json:"body"`
	Tags      string                  `json:"tags"`
	Status    status                  `json:"status"`
	LastMoved time.Time               `json:"last_moved"` // Timestamp of last column change
	TimeSpent map[status]time.Duration `json:"time_spent"` // Accumulated time per column
}

// Title returns the main text for the list item.
func (t task) Title() string       { return t.TitleStr }

// FilterValue defines what the list's search/filter tool looks at.
func (t task) FilterValue() string { return t.TitleStr + " " + t.Tags }

// Description returns the sub-text for the list item, including rendered tags.
func (t task) Description() string {
	desc := t.Body
	if t.Tags != "" {
		desc = fmt.Sprintf("%s | %s", tagStyle.Render("#"+t.Tags), t.Body)
	}
	return desc
}

// Model maintains the global state of the application.
type Model struct {
	lists    []list.Model    // One list for each of the 4 columns
	focused  status          // The column currently navigated by the user
	input    textinput.Model // Shared text input for Title, Desc, and Tags
	editing  bool            // Is the user currently in the input flow?
	isEdit   bool            // Is the current flow an 'Edit' (vs a 'New' task)?
	step     int             // 0: Title, 1: Desc, 2: Tags
	tempTask task            // Temporary storage for task being built/edited
	width    int             // Current terminal width
	height   int             // Current terminal height
	loaded   bool            // Has the first WindowSizeMsg been received?
}

// NewModel initializes the TUI state, sets up columns, and loads saved data.
func NewModel() Model {
	ti := textinput.New()
	ti.Focus()

	m := Model{lists: make([]list.Model, 4), focused: todo, input: ti}
	cols := []string{"To-do", "In Progress", "Review", "Done"}

	for i := range m.lists {
		m.lists[i] = list.New([]list.Item{}, list.NewDefaultDelegate(), 0, 0)
		m.lists[i].Title = cols[i]
		m.lists[i].SetShowHelp(false) // Custom help menu used instead
	}
	m.loadTasks()
	return m
}

// saveTasks serializes all tasks across all columns into a JSON file.
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

// loadTasks reads the JSON file and distributes tasks into their respective columns.
func (m *Model) loadTasks() {
	data, err := os.ReadFile(storageFile)
	if err != nil { return }
	var saved []task
	if json.Unmarshal(data, &saved) == nil {
		for _, t := range saved {
			if t.TimeSpent == nil { t.TimeSpent = make(map[status]time.Duration) }
			m.lists[t.Status].InsertItem(len(m.lists[t.Status].Items()), t)
		}
	}
}

// tick returns a command that sends a tickMsg every second.
func tick() tea.Cmd { return tea.Every(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) }) }

// Init is the first command run by the program.
func (m Model) Init() tea.Cmd { return tick() }

// Update handles all IO (keys, resizing, timers) and updates the Model.
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// If the user is currently typing in the list's filter, bypass global keys.
	if m.lists[m.focused].FilterState() == list.Filtering {
		var cmd tea.Cmd
		m.lists[m.focused], cmd = m.lists[m.focused].Update(msg)
		return m, cmd
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		colWidth, colHeight := (m.width/4)-4, m.height-10
		for i := range m.lists { m.lists[i].SetSize(colWidth, colHeight) }
		m.loaded = true

	case tickMsg:
		return m, tick() // Recursive tick loop

	case tea.KeyMsg:
		// Logic for New/Edit Task Input Flow
		if m.editing {
			switch msg.String() {
			case "enter":
				switch m.step {
				case 0: // Finished Title
					m.tempTask.TitleStr = m.input.Value()
					m.input.Reset()
					m.input.SetValue(m.tempTask.Body)
					m.step = 1
				case 1: // Finished Description
					m.tempTask.Body = m.input.Value()
					m.input.Reset()
					m.input.SetValue(m.tempTask.Tags)
					m.step = 2
				case 2: // Finished Tags - Finalize Save
					m.tempTask.Tags = strings.ReplaceAll(m.input.Value(), " ", "")
					if m.isEdit {
						m.lists[m.focused].SetItem(m.lists[m.focused].Index(), m.tempTask)
					} else {
						m.lists[todo].InsertItem(len(m.lists[todo].Items()), m.tempTask)
					}
					m.saveTasks()
					m.editing, m.isEdit, m.step = false, false, 0
					m.input.Reset()
				}
				return m, nil
			case "esc":
				m.editing, m.isEdit, m.step = false, false, 0
				m.input.Reset()
				return m, nil
			}
			var cmd tea.Cmd
			m.input, cmd = m.input.Update(msg)
			return m, cmd
		}

		// Main Navigation Keys
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "n": // New Task
			m.editing, m.isEdit = true, false
			m.tempTask = task{TimeSpent: make(map[status]time.Duration), LastMoved: time.Now(), Status: todo}
			m.input.Placeholder = "New Title..."
			return m, nil
		case "e": // Edit Task
			items := m.lists[m.focused].Items()
			if len(items) > 0 {
				m.editing, m.isEdit = true, true
				m.tempTask = items[m.lists[m.focused].Index()].(task)
				m.input.SetValue(m.tempTask.TitleStr)
				m.step = 0
			}
			return m, nil
		case "x": // Delete Task
			if len(m.lists[m.focused].Items()) > 0 {
				m.lists[m.focused].RemoveItem(m.lists[m.focused].Index())
				m.saveTasks()
			}
		case "right", "l", "tab":
			if m.focused < done { m.focused++ }
		case "left", "h", "shift+tab":
			if m.focused > todo { m.focused-- }
		case "enter": // Move Task to Next Column
			items := m.lists[m.focused].Items()
			if len(items) > 0 && m.focused < done {
				idx := m.lists[m.focused].Index()
				t := items[idx].(task)
				// Record time spent in the column we are leaving
				t.TimeSpent[t.Status] += time.Since(t.LastMoved)
				m.lists[m.focused].RemoveItem(idx)

				t.Status++
				t.LastMoved = time.Now()
				m.lists[t.Status].InsertItem(len(m.lists[t.Status].Items()), t)
				m.saveTasks()
			}
		}
	}
	var cmd tea.Cmd
	m.lists[m.focused], cmd = m.lists[m.focused].Update(msg)
	return m, cmd
}

// View renders the TUI to the terminal on every frame.
func (m Model) View() string {
	if !m.loaded { return "Initializing board..." }

	colWidth := (m.width / 4) - 4
	var cols []string
	for i := range m.lists {
		style := columnStyle.Copy().Width(colWidth)
		if status(i) == m.focused { style = focusedStyle.Copy().Width(colWidth) }
		cols = append(cols, style.Render(m.lists[i].View()))
	}

	// Combine columns horizontally
	ui := lipgloss.JoinHorizontal(lipgloss.Top, cols...)

	// Bottom Help Bar / Input Field
	help := "←/→: Switch • Enter: Move • N: New • E: Edit • X: Delete • /: Filter • Q: Quit"
	if m.editing {
		labels := []string{"TITLE: ", "DESC: ", "TAGS: "}
		help = inputStyle.Render(labels[m.step]) + m.input.View() + " (Enter: Next, Esc: Cancel)"
	}

	return lipgloss.JoinVertical(lipgloss.Left, ui, help)
}

func main() {
	// tea.WithAltScreen() ensures the TUI runs in its own buffer and cleans up on exit.
	if _, err := tea.NewProgram(NewModel(), tea.WithAltScreen()).Run(); err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}
}
