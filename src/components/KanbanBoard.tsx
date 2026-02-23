import { useState, useRef, useEffect } from "react";
import { Layout, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";

// Types & Hooks
import { useKanban } from "@/hooks/useKanban";
import { COLUMNS, type Column } from "@/types";

// Sub-components
import { TaskCard } from "@/components/TaskCard";
import { AddTaskForm } from "@/components/AddTaskForm";
import { AnalyticsView } from "@/components/AnalyticsView";

// UI Components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COLORS } from "@/constants/colors";
import { FONT_SIZES } from "@/constants/fonts";

const KanbanBoard = () => {
  const [activeTab, setActiveTab] = useState<"board" | "analytics">("board");
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useKanban();

  // Handle snapping to currentColumnIndex when it changes via buttons
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: currentColumnIndex * scrollContainerRef.current.offsetWidth,
        behavior: "smooth",
      });
    }
  }, [currentColumnIndex]);

  // Handle manual scroll to update currentColumnIndex
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 768) return; // Only for mobile
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.offsetWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentColumnIndex) {
      setCurrentColumnIndex(newIndex);
    }
  };

  // Helper for drag position logic
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

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        backgroundColor: COLORS.background.dark,
        color: COLORS.text.primary,
      }}
    >
      {/* Header / Navigation */}
      <header
        className="border-b flex justify-between items-center sticky top-0 z-10 px-4 h-12"
        style={{
          backgroundColor: COLORS.background.panel,
          borderBottomColor: COLORS.border.default,
        }}
      >
        <div className="flex items-center gap-6 h-full">
          <h1
            className="font-bold uppercase tracking-widest border-r pr-6 h-full flex items-center"
            style={{
              color: COLORS.text.secondary,
              borderRightColor: COLORS.border.default,
              fontSize: FONT_SIZES.heading,
            }}
          >
            Kanban
          </h1>

          <nav className="flex gap-4 h-full">
            <button
              onClick={() => setActiveTab("board")}
              className={cn(
                "font-medium flex items-center gap-2 px-2 transition-all border-b-2",
              )}
              style={{
                borderBottomColor:
                  activeTab === "board" ? COLORS.border.accent : "transparent",
                color:
                  activeTab === "board"
                    ? COLORS.text.white
                    : COLORS.text.secondary,
                fontSize: FONT_SIZES.nav,
              }}
            >
              <Layout size={14} /> Board
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={cn(
                "font-medium flex items-center gap-2 px-2 transition-all border-b-2",
              )}
              style={{
                borderBottomColor:
                  activeTab === "analytics"
                    ? COLORS.border.accent
                    : "transparent",
                color:
                  activeTab === "analytics"
                    ? COLORS.text.white
                    : COLORS.text.secondary,
                fontSize: FONT_SIZES.nav,
              }}
            >
              <BarChart3 size={14} /> Analytics
            </button>
          </nav>
        </div>

        {/* Tag Filter Bar (Only visible on Board) */}
        {activeTab === "board" && (
          <div className="flex gap-2 items-center overflow-x-auto no-scrollbar py-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeFilter === tag ? "default" : "outline"}
                className={cn("cursor-pointer px-2 py-0 h-5")}
                style={{
                  backgroundColor:
                    activeFilter === tag
                      ? COLORS.accent.blue
                      : COLORS.background.card,
                  borderColor:
                    activeFilter === tag
                      ? COLORS.border.accent
                      : COLORS.border.default,
                  color:
                    activeFilter === tag
                      ? COLORS.text.white
                      : COLORS.text.secondary,
                  fontSize: FONT_SIZES.xs,
                }}
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

      {/* Main Content Areas */}
      {activeTab === "board" ? (
        <main className="flex-1 flex flex-col relative overflow-hidden h-[calc(100vh-48px)]">
          {/* Mobile Column Navigation */}
          <div className="md:hidden flex items-center justify-between p-4 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
            <button
              onClick={() => setCurrentColumnIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentColumnIndex === 0}
              className="p-1 disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#858585]">
              {COLUMNS[currentColumnIndex]}
            </h2>
            <button
              onClick={() =>
                setCurrentColumnIndex((prev) =>
                  Math.min(COLUMNS.length - 1, prev + 1),
                )
              }
              disabled={currentColumnIndex === COLUMNS.length - 1}
              className="p-1 disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 flex md:grid md:grid-cols-4 md:gap-4 md:p-6 overflow-x-auto snap-x snap-mandatory no-scrollbar md:overflow-hidden"
          >
            {COLUMNS.map((col) => {
              const columnItems = filteredTasks.filter((t) => t.column === col);

              return (
                <div
                  key={col}
                  className="w-full shrink-0 h-full p-4 md:p-0 md:w-auto overflow-hidden snap-center"
                >
                  <Card
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (columnItems.length === 0)
                        setDropIndicator({ column: col, index: 0 });
                    }}
                    onDrop={(e) =>
                      handleDrop(e.dataTransfer.getData("taskId"), col)
                    }
                    className="flex flex-col rounded-md h-full max-h-full overflow-hidden"
                    style={{
                      backgroundColor: COLORS.background.panel,
                      borderColor: COLORS.border.default,
                    }}
                  >
                    <CardHeader
                      className="p-3 border-b flex flex-row justify-between items-center shrink-0"
                      style={{
                        backgroundColor: COLORS.background.card,
                        borderBottomColor: COLORS.border.default,
                      }}
                    >
                      <CardTitle
                        className="font-bold uppercase"
                        style={{
                          color: COLORS.text.secondary,
                          fontSize: FONT_SIZES.heading,
                        }}
                      >
                        {col}
                      </CardTitle>
                      <Badge
                        className=""
                        style={{
                          backgroundColor: COLORS.background.input,
                          color: COLORS.text.primary,
                          fontSize: FONT_SIZES.xs,
                        }}
                      >
                        {columnItems.length}
                      </Badge>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2 min-h-0">
                      {columnItems.map((task, idx) => (
                        <div key={task.id} className="relative">
                          {/* Drop Preview Indicator (Top) */}
                          {dropIndicator.column === col &&
                            dropIndicator.index === idx && (
                              <div
                                className="h-1 my-1 rounded-full animate-pulse"
                                style={{ backgroundColor: COLORS.border.accent }}
                              />
                            )}

                          <TaskCard
                            task={task}
                            isDragged={draggedTaskId === task.id}
                            onDelete={deleteTask}
                            onUpdate={updateTask}
                            onDragStart={(e, id) => {
                              setDraggedTaskId(id);
                              e.dataTransfer.setData("taskId", id);
                            }}
                            onDragOver={(e) => handleDragOverCard(e, col, idx)}
                          />

                          {/* Drop Preview Indicator (Bottom of list) */}
                          {dropIndicator.column === col &&
                            dropIndicator.index === idx + 1 &&
                            idx === columnItems.length - 1 && (
                              <div
                                className="h-1 my-1 rounded-full animate-pulse"
                                style={{ backgroundColor: COLORS.border.accent }}
                              />
                            )}
                        </div>
                      ))}

                      {/* Empty State Drop Zone */}
                      {columnItems.length === 0 &&
                        dropIndicator.column === col && (
                          <div
                            className="h-12 border-2 border-dashed rounded flex items-center justify-center uppercase"
                            style={{
                              borderColor: COLORS.border.default,
                              color: COLORS.text.secondary,
                              fontSize: FONT_SIZES.xs,
                            }}
                          >
                            Drop here
                          </div>
                        )}

                      {/* Add Form (To Do Only) */}
                      {col === "To Do" && (
                        <div className="pt-2">
                          <AddTaskForm onAdd={addTask} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <AnalyticsView tasks={tasks} />
      )}

      {/* Global Scoped Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${COLORS.background.input}; border-radius: 3px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        ::selection { background-color: ${COLORS.background.active}; }
      `}</style>
    </div>
  );
};

export default KanbanBoard;
