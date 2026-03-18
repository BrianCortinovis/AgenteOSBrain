"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
const nanoid_1 = require("nanoid");
function generateId() {
    return (0, nanoid_1.nanoid)(16);
}
