import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COLORS } from "@/constants/colors";
import { FONT_SIZES } from "@/constants/fonts";

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
        className="w-full flex justify-start items-center gap-2 p-2 h-auto text-[#858585] hover:bg-[#37373d] hover:text-[#cccccc] rounded transition-colors group"
        style={{
          color: COLORS.text.secondary,
          fontSize: FONT_SIZES.lg,
        }}
      >
        <Plus size={16} className="group-hover:text-[#007acc]" />
        Add a card
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#2d2d2d] border border-[#007acc] p-3 rounded shadow-xl space-y-2 animate-in fade-in zoom-in duration-150"
      style={{
        backgroundColor: COLORS.background.card,
        borderColor: COLORS.border.accent,
      }}
    >
      <Textarea
        autoFocus
        rows={1}
        className="w-full bg-[#3c3c3c] border-none p-2 rounded focus-visible:ring-1 focus-visible:ring-[#007acc] outline-none min-h-8 resize-none text-white font-bold"
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
        className="w-full bg-[#3c3c3c] border-none p-2 rounded focus-visible:ring-1 focus-visible:ring-[#007acc] outline-none min-h-12 resize-none text-white"
        style={{
          backgroundColor: COLORS.background.input,
          fontSize: FONT_SIZES.taskBody,
        }}
        placeholder="Description..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Input
        className="w-full bg-[#3c3c3c] border-none p-2 h-8 rounded focus-visible:ring-1 focus-visible:ring-[#007acc] outline-none text-white"
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
          className="bg-[#007acc] text-white hover:bg-[#118ad4] h-7 px-4"
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
          className="text-[#858585] hover:text-[#cccccc] hover:bg-[#37373d]"
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
