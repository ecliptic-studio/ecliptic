import { treaty } from '@elysiajs/eden';
import type { App } from '@server/index';

const rpcClient = treaty<App>('localhost:3000') 

export default rpcClient