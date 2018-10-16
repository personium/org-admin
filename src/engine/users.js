function(request) {
    try {
        reqLib.personium.validateRequestMethod(["POST", "DELETE"], request);

        switch(request.method) {
            case "GET":
                break;
            case "PUT":
                break;
            case "POST":
                // Create user

                // Validate parameters
                var params = reqLib.personium.parseBodyAsJSON(request);
                reqLib.personium.setAllowedKeys(["username", "password"]);
                reqLib.personium.setRequiredKeys(["username", "password"]);
                reqLib.personium.validateKeys(params);
                
                return createUser(params);
                break;
            case "DELETE":
                // Validate query
                var query = reqLib.personium.parseQuery(request);
                reqLib.personium.setAllowedKeys(["username"]);
                reqLib.personium.setRequiredKeys(["username"]);
                reqLib.personium.validateKeys(query);
                
                reqLib.adapterX.deleteUser(query.username);
                return {
                    status : 204,
                    headers : {"Content-Type":"application/json"},
                    body: []
                };
                break;
        }
    } catch(e) {
        return reqLib.personium.createErrorResponse(e);
    }
};

// Create a user
function createUser(params){
    var cellToken = reqLib.adapterX.createUser(params);

    return reqLib.personium.createResponse(201, cellToken);
}

/*
 * In order to use helpful functions, you need to "require" the library.
 */
var reqLib = {};
reqLib.personium = require("personium").personium;
reqLib.adapterX = require("adapter").adapterX;
