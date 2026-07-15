"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identifyUser = identifyUser;
function identifyUser(req, _res, next) {
    const userId = req.get('X-User-ID');
    if (userId) {
        req.uid = userId;
    }
    else {
        req.uid = 'default_user';
    }
    next();
}
exports.default = { identifyUser };
//# sourceMappingURL=auth.js.map