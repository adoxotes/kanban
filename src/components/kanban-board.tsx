import { useState, useEffect, useMemo } from "react";
import { Plus, Tag, Clock, X, Layout, BarChart3 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const COLUMNS = ["To Do", "In Progress", "Review", "Done"] as const;
type Column = (typeof COLUMNS)[number];

interface Task {
  id: string;
  text: string;
  tags: string[];
  column: Column;
  createdAt: number;
  lastTransitionTime: number;
  timeLogs: Record<Column, number>;
}

const KanbanBoard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskTags, setNewTaskTags] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "analytics">("board");

  // Track where the user is hovering for visual feedback
  const [dropIndicator, setDropIndicator] = useState<{
    column: Column | null;
    index: number | null;
  }>({ column: null, index: null });

  useEffect(() => {
    const savedTasks = localStorage.getItem("adoxotes-kanban");
    if (savedTasks) setTasks(JSON.parse(savedTasks));
  }, []);

  useEffect(() => {
    localStorage.setItem("adoxotes-kanban", JSON.stringify(tasks));
  }, [tasks]);

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

  const addTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;
    const tags = newTaskTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "");
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText,
      tags: tags,
      column: "To Do",
      createdAt: Date.now(),
      lastTransitionTime: Date.now(),
      timeLogs: { "To Do": 0, "In Progress": 0, Review: 0, Done: 0 },
    };
    setTasks([...tasks, newTask]);
    setNewTaskText("");
    setNewTaskTags("");
    setIsAdding(false);
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverColumn = (e: React.DragEvent, column: Column) => {
    e.preventDefault();
    e.stopPropagation();

    const colTasks = filteredTasks.filter((t) => t.column === column);
    if (colTasks.length === 0) {
      setDropIndicator({ column, index: 0 });
    }
  };

  const handleDragOverCard = (
    e: React.DragEvent,
    column: Column,
    index: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    const targetIndex = e.clientY < midPoint ? index : index + 1;
    setDropIndicator({ column, index: targetIndex });
  };

  const handleDrop = (e: React.DragEvent, targetColumn: Column) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
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

      const updatedDraggedItem: Task = {
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
        updatedDraggedItem,
      );

      const reorderedList: Task[] = [];
      COLUMNS.forEach((col) => {
        if (col === targetColumn) reorderedList.push(...targetColumnTasks);
        else
          reorderedList.push(
            ...otherColumnTasks.filter((t) => t.column === col),
          );
      });

      return reorderedList;
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

  const formatTime = (minutes: number) => {
    const hours = minutes / 60;
    return hours < 0.01 ? "0h" : `${hours.toFixed(2)}h`;
  };

  // Simple SVG BarChart component
  const MiniBarChart = ({
    column,
    tasks,
  }: {
    column: Column;
    tasks: Task[];
  }) => {
    const chartData = tasks
      .map((t) => ({
        name: t.text.substring(0, 10) + "...",
        value: t.timeLogs[column] || 0,
      }))
      .filter((d) => d.value > 0);

    const maxVal = Math.max(...chartData.map((d) => d.value), 1);
    const chartHeight = 120;

    return (
      <Card className="bg-[#2d2d2d] border-[#3c3c3c]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-[#858585] uppercase flex items-center gap-2">
            {column}{" "}
            <span className="text-[10px] lowercase font-normal">
              {" "}
              (Time per task)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-[120px] border-b border-[#3c3c3c] pb-1">
            {chartData.length > 0 ? (
              chartData.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center group relative"
                >
                  <div
                    className="w-full bg-[#007acc] rounded-t-sm hover:bg-[#118ad4] transition-all"
                    style={{ height: `${(d.value / maxVal) * chartHeight}px` }}
                  />
                  <div className="absolute bottom-full mb-2 bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-1 rounded text-[10px] hidden group-hover:block whitespace-nowrap z-20">
                    {d.name}: {formatTime(d.value)}
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6b6b6b]">
                No data
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] text-[#6b6b6b] flex justify-between">
            <span>0h</span>
            <span>Max: {formatTime(maxVal)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#cccccc] font-sans selection:bg-[#264f78]">
      <header className="bg-[#252526] border-b border-[#3c3c3c] flex justify-between items-center sticky top-0 z-10 px-4 h-12">
        <div className="flex items-center gap-6 h-full">
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#858585] border-r border-[#3c3c3c] pr-6 h-full flex items-center">
            Kanban Explorer
          </h1>

          <nav className="flex gap-4 h-full">
            <button
              onClick={() => setActiveTab("board")}
              className={cn(
                "text-[11px] font-medium flex items-center gap-2 px-2 transition-all border-b-2",
                activeTab === "board"
                  ? "border-[#007acc] text-white"
                  : "border-transparent text-[#858585] hover:text-[#cccccc]",
              )}
            >
              <Layout size={14} /> Board
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={cn(
                "text-[11px] font-medium flex items-center gap-2 px-2 transition-all border-b-2",
                activeTab === "analytics"
                  ? "border-[#007acc] text-white"
                  : "border-transparent text-[#858585] hover:text-[#cccccc]",
              )}
            >
              <BarChart3 size={14} /> Analytics
            </button>
          </nav>
        </div>

        {activeTab === "board" && (
          <div className="flex gap-2 items-center overflow-x-auto no-scrollbar py-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeFilter === tag ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-[10px] px-2 py-0 h-5",
                  activeFilter === tag
                    ? "bg-[#007acc] border-[#007acc] hover:bg-[#118ad4]"
                    : "bg-[#2d2d2d] border-[#3c3c3c] text-[#858585] hover:bg-[#37373d]",
                )}
                onClick={() =>
                  setActiveFilter(activeFilter === tag ? null : tag)
                }
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {activeTab === "board" ? (
        <main className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-48px)]">
          {COLUMNS.map((col) => {
            const columnItems = filteredTasks.filter((t) => t.column === col);

            return (
              <Card
                key={col}
                onDragOver={(e) => handleDragOverColumn(e, col)}
                onDrop={(e) => handleDrop(e, col)}
                className="flex flex-col bg-[#252526] rounded-md border-[#3c3c3c] h-full max-h-full overflow-hidden"
              >
                <CardHeader className="p-3 border-b border-[#3c3c3c] bg-[#2d2d2d] flex flex-row justify-between items-center shrink-0">
                  <CardTitle className="text-xs font-bold uppercase text-[#858585]">
                    {col}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-[#3c3c3c] text-[#cccccc] hover:bg-[#3c3c3c] h-5 min-w-5 justify-center"
                  >
                    {columnItems.length}
                  </Badge>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                  {columnItems.map((task, idx) => (
                    <div
                      key={task.id}
                      className="relative"
                      onDragOver={(e) => handleDragOverCard(e, col, idx)}
                    >
                      {dropIndicator.column === col &&
                        dropIndicator.index === idx && (
                          <div className="h-1 bg-[#007acc] my-1 rounded-full animate-pulse" />
                        )}

                      <Card
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className={cn(
                          "group bg-[#2d2d2d] border-[#3c3c3c] p-3 transition-all cursor-grab active:cursor-grabbing hover:border-[#4b4b4b] rounded-sm",
                          draggedTaskId === task.id &&
                            "opacity-30 border-[#007acc]",
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm text-[#cccccc] leading-snug break-words pr-4 select-none pointer-events-none">
                            {task.text}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => deleteTask(task.id)}
                            className="text-[#858585] hover:text-red-400 hover:bg-transparent h-4 w-4"
                          >
                            <X size={14} />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {task.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[9px] bg-[#1e1e1e] text-[#858585] border-[#3c3c3c] px-1 h-4"
                            >
                              <Tag size={8} className="mr-1" /> {tag}
                            </Badge>
                          ))}
                        </div>

                        <Separator className="bg-[#3c3c3c] mb-2" />

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-[#6b6b6b] font-mono">
                            <Clock size={10} />
                            <span>{formatTime(task.timeLogs[col] || 0)}</span>
                          </div>
                        </div>
                      </Card>

                      {dropIndicator.column === col &&
                        dropIndicator.index === idx + 1 &&
                        idx === columnItems.length - 1 && (
                          <div className="h-1 bg-[#007acc] my-1 rounded-full animate-pulse" />
                        )}
                    </div>
                  ))}

                  {columnItems.length === 0 && dropIndicator.column === col && (
                    <div className="h-12 border-2 border-dashed border-[#3c3c3c] rounded flex items-center justify-center text-[10px] text-[#858585] uppercase tracking-widest">
                      Drop here
                    </div>
                  )}

                  {col === "To Do" && (
                    <div className="pt-2">
                      {isAdding ? (
                        <form
                          onSubmit={addTask}
                          className="bg-[#2d2d2d] border border-[#007acc] p-3 rounded shadow-xl space-y-2"
                        >
                          <Textarea
                            autoFocus
                            rows={2}
                            className="w-full bg-[#3c3c3c] border-none text-sm p-2 rounded focus-visible:ring-1 focus-visible:ring-[#007acc] outline-none min-h-[60px] resize-none"
                            placeholder="Card title..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                addTask();
                              }
                            }}
                          />
                          <Input
                            className="w-full bg-[#3c3c3c] border-none text-[11px] p-2 h-8 rounded focus-visible:ring-1 focus-visible:ring-[#007acc] outline-none"
                            placeholder="Tags (comma separated)..."
                            value={newTaskTags}
                            onChange={(e) => setNewTaskTags(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              className="bg-[#007acc] text-white hover:bg-[#118ad4] h-7 px-4"
                            >
                              Add
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setIsAdding(false)}
                              className="text-[#858585] hover:text-[#cccccc] hover:bg-[#37373d]"
                            >
                              <X size={18} />
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => setIsAdding(true)}
                          className="w-full flex justify-start items-center gap-2 p-2 h-auto text-sm text-[#858585] hover:bg-[#37373d] hover:text-[#cccccc] rounded transition-colors group"
                        >
                          <Plus
                            size={16}
                            className="group-hover:text-[#007acc]"
                          />
                          Add a card
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </main>
      ) : (
        <main className="p-6 max-w-6xl mx-auto h-[calc(100vh-48px)] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COLUMNS.map((col) => (
              <MiniBarChart key={col} column={col} tasks={tasks} />
            ))}
          </div>
          <Card className="mt-8 p-4 bg-[#252526] border-[#3c3c3c] text-xs text-[#858585]">
            <h4 className="font-bold mb-2 flex items-center gap-2 uppercase text-[10px]">
              <Clock size={12} /> Analytics Legend
            </h4>
            <p>
              These charts show the total active time each task spent in a
              specific column. Time is logged while a task resides in a column,
              updated every minute.
            </p>
          </Card>
        </main>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3c3c3c; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b4b4b; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default KanbanBoard;
