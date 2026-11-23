// Starts the welcome intro as early as possible. This file only pulls in the intro itself (welcome.js, the catalog
// and the tour, a few KB): it does not wait for main.js, the 3D library or the views to download, so "hello"
// appears straight away instead of after the whole site has loaded.
import { autoWelcome } from './welcome.js';

if (!location.hash.replace(/^#\/?/, '').split('?')[0]) autoWelcome();
