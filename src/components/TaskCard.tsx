import { useState, useRef, useEffect } from "react";
import { type Task } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tag, Clock, X, Check, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLORS } from "@/constants/colors";
import { FONT_SIZES } from "@/constants/fonts";

// Import Shadcn Alert Dialog components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TaskCardProps {
  task: Task;
  isDragged: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string, tags: string, body: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}

export const TaskCard = ({
  task,
  isDragged,
  onDelete,
  onUpdate,
  onDragStart,
  onDragOver,
}: TaskCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(task.text);
  const [editedBody, setEditedBody] = useState(task.body || "");
  const [editedTags, setEditedTags] = useState(task.tags.join(", "));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (!editedText.trim()) return;
    onUpdate(task.id, editedText, editedTags, editedBody);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(task.text);
    setEditedBody(task.body || "");
    setEditedTags(task.tags.join(", "));
    setIsEditing(false);
  };

  const formatTime = (minutes: number) => {
    const hours = minutes / 60;
    return hours < 0.01 ? "0h" : `${hours.toFixed(2)}h`;
  };

  return (
    <Card
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragOver={onDragOver}
      className={cn(
        "group p-3 transition-all rounded-sm",
        isDragged && "opacity-30",
        !isEditing && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        backgroundColor: COLORS.background.card,
        borderColor: isDragged ? COLORS.border.accent : COLORS.border.default,
      }}
      onMouseEnter={(e) => {
        if (!isDragged && !isEditing)
          e.currentTarget.style.borderColor = COLORS.border.hover;
      }}
      onMouseLeave={(e) => {
        if (!isDragged && !isEditing)
          e.currentTarget.style.borderColor = COLORS.border.default;
      }}
    >
      <div className="flex justify-between items-start mb-2">
        {isEditing ? (
          <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <div
              className="uppercase font-bold text-[#858585]"
              style={{ fontSize: FONT_SIZES.label }}
            >
              Title
            </div>
            <Input
              ref={textareaRef as any}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="bg-[#3c3c3c] border-none focus-visible:ring-1 focus-visible:ring-[#007acc] text-white p-2 h-8"
              style={{ fontSize: FONT_SIZES.taskBody }}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleCancel();
              }}
            />
            <div
              className="uppercase font-bold text-[#858585]"
              style={{ fontSize: FONT_SIZES.label }}
            >
              Description
            </div>
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              placeholder="Task description..."
              className="bg-[#3c3c3c] border-none focus-visible:ring-1 focus-visible:ring-[#007acc] text-white min-h-[80px] resize-none p-2"
              style={{ fontSize: FONT_SIZES.taskBody }}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleCancel();
              }}
            />
            <div
              className="uppercase font-bold text-[#858585]"
              style={{ fontSize: FONT_SIZES.label }}
            >
              Tags
            </div>
            <Input
              value={editedTags}
              onChange={(e) => setEditedTags(e.target.value)}
              placeholder="Tags (comma separated)..."
              className="h-7 bg-[#3c3c3c] border-none focus-visible:ring-1 focus-visible:ring-[#007acc] text-white p-2"
              style={{ fontSize: FONT_SIZES.sm }}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleCancel();
              }}
            />
            <div className="flex gap-2 pt-1">
              <Button
                size="icon-xs"
                onClick={handleSave}
                className="bg-[#007acc] hover:bg-[#118ad4] text-white h-6 w-6"
              >
                <Check size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCancel}
                className="text-[#858585] hover:text-[#cccccc] h-6 w-6"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1">
              <p
                className="font-bold leading-snug wrap-break-word pr-4 select-none pointer-events-none mb-1"
                style={{ color: COLORS.text.primary, fontSize: FONT_SIZES.taskTitle }}
              >
                {task.text}
              </p>
              {task.body && (
                <p
                  className="leading-relaxed line-clamp-2 text-[#858585] pointer-events-none select-none"
                  style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.taskBody }}
                >
                  {task.body}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="hover:bg-transparent h-4 w-4"
                style={{ color: COLORS.text.secondary }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = COLORS.text.accent)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = COLORS.text.secondary)
                }
              >
                <Edit2 size={12} />
              </Button>

              {/* Wrap the Delete Button in the Alert Dialog */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-transparent h-4 w-4"
                    style={{ color: COLORS.text.secondary }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = COLORS.text.error)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = COLORS.text.secondary)
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    <X size={14} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  className="border"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: COLORS.background.panel,
                    borderColor: COLORS.border.default,
                    color: COLORS.text.primary,
                  }}
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle style={{ color: COLORS.text.white }}>
                      Delete Task?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete{" "}
                      <span
                        className="italic"
                        style={{ color: COLORS.text.primary }}
                      >
                        "{task.text}"
                      </span>
                      ? This will also remove all tracked time logs for this task.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel
                      className="bg-transparent border hover:text-white border-none"
                      style={{
                        borderColor: COLORS.border.default,
                        color: COLORS.text.secondary,
                      }}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(task.id)}
                      className="text-white border-none"
                      style={{
                        backgroundColor: COLORS.accent.red,
                      }}
                    >
                      Delete Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <>
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="px-1 h-4"
                style={{
                  backgroundColor: COLORS.background.dark,
                  color: COLORS.text.secondary,
                  borderColor: COLORS.border.default,
                  fontSize: FONT_SIZES.tag,
                }}
              >
                <Tag size={8} className="mr-1" /> {tag}
              </Badge>
            ))}
          </div>

          <Separator
            className="mb-2"
            style={{ backgroundColor: COLORS.border.default }}
          />

          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-1.5 font-mono"
              style={{ color: COLORS.text.muted, fontSize: FONT_SIZES.xs }}
            >
              <Clock size={10} />
              <span>{formatTime(task.timeLogs[task.column] || 0)}</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
