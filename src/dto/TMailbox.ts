

export type TMailbox = {
  email: string;
  name: string;
  todoCount: number;
  provider: 'microsoft' | 'google';
  createdAt: string;
  updatedAt: string;
}