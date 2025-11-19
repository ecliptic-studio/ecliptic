

export type TMailboxEmail = {
  id: string;
  
  email: string;
  todoCount: number;
  provider: 'microsoft' | 'google';
}