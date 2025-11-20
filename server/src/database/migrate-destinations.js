"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/migrate-destinations.ts
var db_1 = require("../../src/utils/db"); // your PG pool
var crypto_1 = require("../modules/notifications/utils/crypto");
function migrateDestinations() {
    return __awaiter(this, void 0, void 0, function () {
        var client, res, _i, _a, row, id, recipient_destination, encrypted, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("🔄 Starting migration of recipient_destination...");
                    return [4 /*yield*/, db_1.pool.connect()];
                case 1:
                    client = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 10, 12, 13]);
                    return [4 /*yield*/, client.query("BEGIN")];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, client.query("SELECT id, recipient_destination FROM notifications")];
                case 4:
                    res = _b.sent();
                    if (res.rows.length === 0) {
                        console.log("ℹ️ No notifications found for migration.");
                        return [2 /*return*/];
                    }
                    console.log("Found ".concat(res.rows.length, " notifications to migrate."));
                    _i = 0, _a = res.rows;
                    _b.label = 5;
                case 5:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    row = _a[_i];
                    id = row.id, recipient_destination = row.recipient_destination;
                    // Skip if already looks encrypted
                    if ((recipient_destination === null || recipient_destination === void 0 ? void 0 : recipient_destination.length) > 50)
                        return [3 /*break*/, 7];
                    encrypted = (0, crypto_1.encryptDestination)(recipient_destination);
                    return [4 /*yield*/, client.query("UPDATE notifications SET recipient_destination=$1 WHERE id=$2", [encrypted, id])];
                case 6:
                    _b.sent();
                    console.log("\u2705 Updated notification ".concat(id));
                    _b.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8: return [4 /*yield*/, client.query("COMMIT")];
                case 9:
                    _b.sent();
                    console.log("🎉 Migration completed successfully!");
                    return [3 /*break*/, 13];
                case 10:
                    err_1 = _b.sent();
                    return [4 /*yield*/, client.query("ROLLBACK")];
                case 11:
                    _b.sent();
                    console.error("❌ Migration failed:", err_1);
                    return [3 /*break*/, 13];
                case 12:
                    client.release();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
migrateDestinations().then(function () { return process.exit(0); });
