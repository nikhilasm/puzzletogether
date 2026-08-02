/**
 * Client entry point: fonts, global styles, and the root element.
 *
 * Fonts are self-hosted through `@fontsource` — no third-party request and no FOUT tied to someone
 * else's uptime (brand.md §2).
 */

import '@fontsource-variable/fraunces';
import '@fontsource/karla/400.css';
import '@fontsource/karla/700.css';
import '@fontsource/dm-mono/400.css';

import './styles/tokens.css';
import './styles/base.css';

import './views/pt-app.js';
