import './styles/main.css';
import { App } from './ui/app';
import { setupPwa } from './ui/pwa';

const app = new App();
void app.start();
setupPwa();
