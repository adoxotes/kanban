import { useState, useEffect, useMemo } from "react";
import { type Task, type Column, COLUMNS } from "@/types";

export const useKanban = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adoxotes-kanban");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    column: Column | null;
    index: number | null;
  }>({ column: null, index: null });

  useEffect(() => {
    localStorage.setItem("adoxotes-kanban", JSON.stringify(tasks));
  }, [tasks]);

  // Time Tracking Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          const now = Date.now();
          const lastUpdate = task.lastTransitionTime || now;
          const elapsedMinutes = (now - lastUpdate) / (1000 * 60);
          const updatedTimeLogs = { ...task.timeLogs };
          updatedTimeLogs[task.column] =
            (updatedTimeLogs[task.column] || 0) + elapsedMinutes;
          return {
            ...task,
            timeLogs: updatedTimeLogs,
            lastTransitionTime: now,
          };
        }),
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const addTask = (text: string, tagsString: string, body: string = "") => {
    const tags = tagsString
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "");
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      body,
      tags,
      column: "To Do",
      createdAt: Date.now(),
      lastTransitionTime: Date.now(),
      timeLogs: { "To Do": 0, "In Progress": 0, Review: 0, Done: 0 },
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const deleteTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  const updateTask = (
    id: string,
    text: string,
    tagsString: string,
    body: string,
  ) => {
    const tags = tagsString
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "");
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text, tags, body } : t)),
    );
  };

  const handleDrop = (taskId: string, targetColumn: Column) => {
    const targetIndex = dropIndicator.index;
    setTasks((prev) => {
      const allTasks = [...prev];
      const draggedItem = allTasks.find((t) => t.id === taskId);
      if (!draggedItem) return prev;

      const otherColumnTasks = allTasks.filter(
        (t) => t.column !== targetColumn && t.id !== taskId,
      );
      const targetColumnTasks = allTasks.filter(
        (t) => t.column === targetColumn && t.id !== taskId,
      );

      const updatedItem: Task = {
        ...draggedItem,
        column: targetColumn,
        lastTransitionTime:
          draggedItem.column !== targetColumn
            ? Date.now()
            : draggedItem.lastTransitionTime,
      };

      targetColumnTasks.splice(
        targetIndex === null ? targetColumnTasks.length : targetIndex,
        0,
        updatedItem,
      );

      const reordered: Task[] = [];
      COLUMNS.forEach((col) => {
        if (col === targetColumn) reordered.push(...targetColumnTasks);
        else
          reordered.push(...otherColumnTasks.filter((t) => t.column === col));
      });
      return reordered;
    });
    setDraggedTaskId(null);
    setDropIndicator({ column: null, index: null });
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }, [tasks]);

  const filteredTasks = activeFilter
    ? tasks.filter((t) => t.tags.includes(activeFilter))
    : tasks;

  return {
    tasks,
    filteredTasks,
    allTags,
    activeFilter,
    setActiveFilter,
    draggedTaskId,
    setDraggedTaskId,
    dropIndicator,
    setDropIndicator,
    addTask,
    deleteTask,
    updateTask,
    handleDrop,
  };
};
