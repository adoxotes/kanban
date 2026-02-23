import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COLORS } from "@/constants/colors";
import { COLOR_CLASSES } from "@/constants/colorClasses";
import { FONT_SIZES } from "@/constants/fonts";
import { cn } from "@/lib/utils";

interface AddTaskFormProps {
  onAdd: (text: string, tags: string, body: string) => void;
}

export const AddTaskForm = ({ onAdd }: AddTaskFormProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    onAdd(text, tags, body);
    setText("");
    setBody("");
    setTags("");
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        onClick={() => setIsAdding(true)}
        className={cn(
          "w-full flex justify-start items-center gap-2 p-2 h-auto rounded transition-colors group",
          COLOR_CLASSES.text.secondary,
          COLOR_CLASSES.bg.hover,
          COLOR_CLASSES.text.primaryHover,
        )}
        style={{
          color: COLORS.text.secondary,
          fontSize: FONT_SIZES.lg,
        }}
      >
        <Plus size={16} className={COLOR_CLASSES.text.accentGroupHover} />
        Add a card
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "p-3 rounded shadow-xl space-y-2 animate-in fade-in zoom-in duration-150 border",
        COLOR_CLASSES.bg.card,
        COLOR_CLASSES.border.accent,
      )}
      style={{
        backgroundColor: COLORS.background.card,
        borderColor: COLORS.border.accent,
      }}
    >
      <Textarea
        autoFocus
        rows={1}
        className={cn(
          "w-full border-none p-2 rounded outline-none min-h-8 resize-none text-white font-bold",
          COLOR_CLASSES.bg.input,
          COLOR_CLASSES.ring.accent,
          "focus-visible:ring-1",
        )}
        style={{
          backgroundColor: COLORS.background.input,
          fontSize: FONT_SIZES.taskTitle,
        }}
        placeholder="Task title..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <Textarea
        rows={2}
        className={cn(
          "w-full border-none p-2 rounded outline-none min-h-12 resize-none text-white",
          COLOR_CLASSES.bg.input,
          COLOR_CLASSES.ring.accent,
          "focus-visible:ring-1",
        )}
        style={{
          backgroundColor: COLORS.background.input,
          fontSize: FONT_SIZES.taskBody,
        }}
        placeholder="Description..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Input
        className={cn(
          "w-full border-none p-2 h-8 rounded outline-none text-white",
          COLOR_CLASSES.bg.input,
          COLOR_CLASSES.ring.accent,
          "focus-visible:ring-1",
        )}
        style={{
          backgroundColor: COLORS.background.input,
          fontSize: FONT_SIZES.sm,
        }}
        placeholder="Tags (comma separated)..."
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className={cn(
            "text-white h-7 px-4",
            COLOR_CLASSES.bg.accent,
            COLOR_CLASSES.bg.accentHover,
          )}
          style={{
            backgroundColor: COLORS.accent.blue,
          }}
        >
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsAdding(false)}
          className={cn(
            COLOR_CLASSES.text.secondary,
            COLOR_CLASSES.text.primaryHover,
            COLOR_CLASSES.bg.hover,
          )}
          style={{
            color: COLORS.text.secondary,
          }}
        >
          <X size={18} />
        </Button>
      </div>
    </form>
  );
};
