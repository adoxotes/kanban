// Terminal User Interface (TUI) Kanban board.
// It uses the Bubble Tea architectural pattern (Model-View-Update).
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

// Configuration
const storageFile = "kanban.json"

// Status represents the column/stage of a task.
type status int

const (
	todo status = iota
	inProgress
	review
	done
)

var (
	columnStyle  = lipgloss.NewStyle().Padding(1, 1).Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("240"))
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
	// The width is dynamically calculated in the view
	if t.Tags != "" {
		return fmt.Sprintf("%s\n%s", t.Content, tagStyle.Render("#"+t.Tags))
	}
	return t.Content
}

// Application Model
type Model struct {
	lists    []list.Model
	focused  status
	input    textinput.Model
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

	m := Model{
		lists: make([]list.Model, 4),
		input: ti,
	}

	cols := []string{"To-do", "In Progress", "Review", "Done"}
	for i := range m.lists {
		d := list.NewDefaultDelegate()
		d.SetHeight(6)
		// Restoring your original high-contrast list colors
		d.Styles.NormalTitle = d.Styles.NormalTitle.Foreground(lipgloss.Color("255"))
		d.Styles.SelectedTitle = d.Styles.SelectedTitle.Foreground(lipgloss.Color("255")).Bold(true)
		d.Styles.NormalDesc = d.Styles.NormalDesc.Foreground(lipgloss.Color("252"))
		d.Styles.SelectedDesc = d.Styles.SelectedDesc.Foreground(lipgloss.Color("252"))

		m.lists[i] = list.New([]list.Item{}, d, 0, 0)
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
		colWidth := (m.width / 4) - 4
		for i := range m.lists {
			m.lists[i].SetSize(colWidth, m.height-7)
		}
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

func (m Model) View() string {
	if !m.loaded {
		return "Initializing board..."
	}

	colWidth := (m.width / 4) - 2
	var cols []string
	for i := range m.lists {
		style := columnStyle.Width(colWidth)
		if status(i) == m.focused {
			style = focusedStyle.Width(colWidth)
		}
		cols = append(cols, style.Render(m.lists[i].View()))
	}

	ui := lipgloss.JoinHorizontal(lipgloss.Top, cols...)

	help := "←/→: Switch • [/]: Move • N: New • E: Edit • X: Delete • /: Filter • Q: Quit"
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
