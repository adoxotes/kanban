package main

import (
	"os"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/stretchr/testify/assert"
)

func TestTaskMethods(t *testing.T) {
	tk := task{
		TitleStr: "Test Task",
		Content:  "Test Content",
		Tags:     "tag1,tag2",
		Status:   todo,
	}

	assert.Equal(t, "Test Task", tk.Title())
	assert.Equal(t, "Test Task tag1,tag2", tk.FilterValue())
	assert.Contains(t, tk.Description(), "Test Content")
	assert.Contains(t, tk.Description(), "#tag1,tag2")

	tkNoTags := task{
		TitleStr: "No Tags",
		Content:  "Content",
	}
	assert.Equal(t, "Content", tkNoTags.Description())
}

func TestModelInitialization(t *testing.T) {
	// Use a temporary file for testing persistence
	tmpFile, err := os.CreateTemp("", "kanban_test_*.json")
	assert.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	storageFile = tmpFile.Name()

	m := NewModel()
	assert.Len(t, m.lists, 4)
	assert.Equal(t, todo, m.focused)
	assert.False(t, m.editing)
}

func TestPersistence(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "kanban_test_persistence_*.json")
	assert.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	storageFile = tmpFile.Name()

	m := NewModel()
	tk := task{TitleStr: "Persistent Task", Status: todo, TimeSpent: make(map[status]time.Duration)}
	m.lists[todo].InsertItem(0, tk)
	m.saveTasks()

	// Load in a new model
	m2 := NewModel()
	assert.Len(t, m2.lists[todo].Items(), 1)
	loadedTask := m2.lists[todo].Items()[0].(task)
	assert.Equal(t, "Persistent Task", loadedTask.TitleStr)
}

func TestModelUpdateNavigation(t *testing.T) {
	m := NewModel()
	m.loaded = true // Simulate window size received

	// Test Right navigation
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRight})
	assert.Equal(t, inProgress, m.focused)

	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRight})
	assert.Equal(t, review, m.focused)

	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRight})
	assert.Equal(t, done, m.focused)

	// Test Right boundary
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRight})
	assert.Equal(t, done, m.focused)

	// Test Left navigation
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyLeft})
	assert.Equal(t, review, m.focused)
}

func TestTaskManagement(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "kanban_test_mgmt_*.json")
	assert.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	storageFile = tmpFile.Name()

	m := NewModel()
	m.loaded = true

	// Add new task
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("n")})
	assert.True(t, m.editing)
	assert.Equal(t, 0, m.step)

	// Enter Title
	m.input.SetValue("New Task")
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyEnter})
	assert.Equal(t, 1, m.step)
	assert.Equal(t, "New Task", m.tempTask.TitleStr)

	// Enter Description
	m.input.SetValue("Desc")
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyEnter})
	assert.Equal(t, 2, m.step)

	// Enter Tags
	m.input.SetValue("tag1")
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyEnter})
	assert.False(t, m.editing)
	assert.Len(t, m.lists[todo].Items(), 1)

	// Move Task
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyEnter}) // Move to In Progress
	assert.Len(t, m.lists[todo].Items(), 0)
	assert.Len(t, m.lists[inProgress].Items(), 1)

	// Delete Task
	m.focused = inProgress
	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("x")})
	assert.True(t, m.deleting)
	assert.Len(t, m.lists[inProgress].Items(), 1) // Should still be there

	m, _ = updateModel(m, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("y")})
	assert.False(t, m.deleting)
	assert.Len(t, m.lists[inProgress].Items(), 0) // Now it should be gone
}

// Helper to handle Model vs *Model updates
func updateModel(m Model, msg tea.Msg) (Model, tea.Cmd) {
	newModel, cmd := m.Update(msg)
	if pm, ok := newModel.(*Model); ok {
		return *pm, cmd
	}
	return newModel.(Model), cmd
}
