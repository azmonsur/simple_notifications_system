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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePool = exports.retryQuery = exports.query = exports.pool = void 0;
var pg_1 = require("pg");
var common_1 = require("@nestjs/common");
var dotenv = require("dotenv");
dotenv.config();
var logger = new common_1.Logger("Postgres");
var POSTGRE_URL = process.env.NODE_ENV === "production"
    ? process.env.POSTGRE_URL_PROD
    : process.env.POSTGRE_URL_DEV;
exports.pool = new pg_1.Pool({
    connectionString: POSTGRE_URL,
    max: 20,
    idleTimeoutMillis: 30000, // close idle clients after 15s
    connectionTimeoutMillis: 5000,
});
// export const pool = new Pool({
//   user: "postgres.hyuvqjcbwdsbemnnbomn",
//   password: "Omotayo_sql0308",
//   host: "aws-1-eu-north-1.pooler.supabase.com",
//   port: 5432,
//   database: "postgres",
//   max: 20,
//   idleTimeoutMillis: 30000, // close idle clients after 30s
//   connectionTimeoutMillis: 5000, // fail fast if cannot connect
// });
exports.pool.on("error", function (err) {
    logger.error("Unexpected Postgres error on idle client", err);
});
// Keep-alive ping
setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
    var err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, exports.pool.query("SELECT 1")];
            case 1:
                _a.sent();
                logger.debug("Postgres keep-alive ping succeeded");
                return [3 /*break*/, 3];
            case 2:
                err_1 = _a.sent();
                logger.warn("Postgres keep-alive ping failed", err_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); }, 250000);
var query = function (sql, params) { return __awaiter(void 0, void 0, void 0, function () {
    var start, result, duration, err_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                start = Date.now();
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, exports.pool.query(sql, params)];
            case 2:
                result = _a.sent();
                duration = Date.now() - start;
                logger.log("Query executed in ".concat(duration, "ms, rows: ").concat(result.rowCount));
                return [2 /*return*/, result];
            case 3:
                err_2 = _a.sent();
                logger.error("DB Query Error: ".concat(err_2.message), err_2.stack);
                throw err_2;
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.query = query;
var retryQuery = function (sql_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([sql_1], args_1, true), void 0, function (sql, params, retries, delayMs) {
        var _loop_1, attempt, state_1;
        if (params === void 0) { params = []; }
        if (retries === void 0) { retries = 5; }
        if (delayMs === void 0) { delayMs = 200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function (attempt) {
                        var _b, err_3, retriableErrors;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 5]);
                                    _b = {};
                                    return [4 /*yield*/, (0, exports.query)(sql, params)];
                                case 1: return [2 /*return*/, (_b.value = _c.sent(), _b)];
                                case 2:
                                    err_3 = _c.sent();
                                    retriableErrors = [
                                        "ECONNRESET",
                                        "ETIMEDOUT",
                                        "ECONNREFUSED",
                                        "EPIPE",
                                        "ENETDOWN",
                                        "Connection terminated unexpectedly",
                                        "db_termination",
                                        "57P01", // admin shutdown
                                    ];
                                    if (!(attempt < retries &&
                                        (retriableErrors.some(function (e) { return err_3.message.includes(e); }) ||
                                            retriableErrors.includes(err_3.code)))) return [3 /*break*/, 4];
                                    logger.warn("Transient DB error, retrying attempt ".concat(attempt, " in ").concat(delayMs * attempt, "ms..."));
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, delayMs * attempt); })];
                                case 3:
                                    _c.sent();
                                    return [2 /*return*/, "continue"];
                                case 4: throw err_3;
                                case 5: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
};
exports.retryQuery = retryQuery;
var closePool = function () { return __awaiter(void 0, void 0, void 0, function () {
    var err_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, exports.pool.end()];
            case 1:
                _a.sent();
                logger.log("Postgres pool closed.");
                return [3 /*break*/, 3];
            case 2:
                err_4 = _a.sent();
                logger.error("Error closing Postgres pool:", err_4);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.closePool = closePool;
