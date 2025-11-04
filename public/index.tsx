import { createRoot } from 'react-dom/client'
import App from './App'
import '@public/styles/global.css'


const root = createRoot(document.getElementById('elysia')!)
root.render(
	<App />
)
