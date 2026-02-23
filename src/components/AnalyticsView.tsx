import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { type Task, type Column, COLUMNS } from "@/types";
import { COLORS } from "@/constants/colors";
import { FONT_SIZES } from "@/constants/fonts";

const MiniBarChart = ({ column, tasks }: { column: Column; tasks: Task[] }) => {
  const chartData = tasks
    .map((t) => ({
      name: t.text.substring(0, 10) + "...",
      value: t.timeLogs[column] || 0,
    }))
    .filter((d) => d.value > 0);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const chartHeight = 120;
  const formatTime = (m: number) =>
    m / 60 < 0.01 ? "0h" : `${(m / 60).toFixed(2)}h`;

  return (
    <Card
      className="bg-[#2d2d2d] border-[#3c3c3c]"
      style={{
        backgroundColor: COLORS.background.card,
        borderColor: COLORS.border.default,
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle
          className="font-bold uppercase"
          style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.xs }}
        >
          {column}{" "}
          <span
            className="lowercase font-normal"
            style={{ fontSize: FONT_SIZES.xs }}
          >
            (Time per task)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="flex items-end gap-2 h-30 border-b pb-1"
          style={{ borderBottomColor: COLORS.border.default }}
        >
          {chartData.length > 0 ? (
            chartData.map((d, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center group relative"
              >
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${(d.value / maxVal) * chartHeight}px`,
                    backgroundColor: COLORS.accent.blue,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      COLORS.accent.blueHover)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = COLORS.accent.blue)
                  }
                />
                <div
                  className="absolute bottom-full mb-2 border px-2 py-1 rounded hidden group-hover:block z-20"
                  style={{
                    backgroundColor: COLORS.background.dark,
                    borderColor: COLORS.border.default,
                    fontSize: FONT_SIZES.xs,
                  }}
                >
                  {d.name}: {formatTime(d.value)}
                </div>
              </div>
            ))
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ color: COLORS.text.muted, fontSize: FONT_SIZES.xs }}
            >
              No data
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const AnalyticsView = ({ tasks }: { tasks: Task[] }) => (
  <main className="p-6 max-w-6xl mx-auto h-[calc(100vh-48px)] overflow-y-auto custom-scrollbar">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {COLUMNS.map((col) => (
        <MiniBarChart key={col} column={col} tasks={tasks} />
      ))}
    </div>
    <Card
      className="mt-8 p-4"
      style={{
        backgroundColor: COLORS.background.panel,
        borderColor: COLORS.border.default,
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.xs,
      }}
    >
      <h4
        className="font-bold mb-2 flex items-center gap-2 uppercase"
        style={{ fontSize: FONT_SIZES.xs }}
      >
        <Clock size={12} /> Analytics Legend
      </h4>
      <p>Active time tracking is updated every minute.</p>
    </Card>
  </main>
);
