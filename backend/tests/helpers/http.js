// backend/tests/helpers/http.js
import request from 'supertest';
import { app } from '../../src/app.js';

export const api = () => request(app);
