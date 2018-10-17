function(request){
    try {
        reqLib.personium.validateRequestMethod(["PUT"], request);
        
        var params = reqLib.personium.parseBodyAsJSON(request);

        // Keys other than "username" or "password" are not allowed.
        reqLib.personium.setAllowedKeys(["username", "password"]);

        // Both "username" and "password" are required.
        reqLib.personium.setRequiredKeys(["username", "password"]);

        /* 
         * Validate all keys according to the following rules.
         * 1. whether it is included in params
         * 2. whether its value is undefined
         * 3. whether its value is null
         */
        reqLib.personium.validateKeys(params);

        reqLib.adapterX.resetPassword(params.username, params.password);

        return reqLib.personium.createResponse(200, params);
    } catch (e) {
        return reqLib.personium.createErrorResponse(e);
    }
};


/*
 * In order to use helpful functions, you need to "require" the library.
 */
var reqLib = {};
reqLib.personium = require("personium").personium;
reqLib.adapterX = require("adapter").adapterX;
