export const COLUMNS = ["To Do", "In Progress", "Review", "Done"] as const;
export type Column = (typeof COLUMNS)[number];

export interface Task {
  id: string;
  text: string;
  body: string;
  tags: string[];
  column: Column;
  createdAt: number;
  lastTransitionTime: number;
  timeLogs: Record<Column, number>;
}
