function(request) {
    try {
        reqLib.personium.validateRequestMethod(["POST", "PUT", "GET"], request);

        // Methodで処理を分ける
        switch(request.method) {
            case "GET":
                var query = reqLib.personium.parseQuery(request);

                if (query.username) {
                    // Get one user's profile

                    // Validate query
                    reqLib.personium.setAllowedKeys(["username"]);
                    reqLib.personium.setRequiredKeys(["username"]);
                    reqLib.personium.validateKeys(query);

                    return retrieveUserProfile(query.username);
                } else {
                    // 一覧取得
                    // Validate query
                    reqLib.personium.setAllowedKeys(["$top", "$skip", "$orderby", "$filter"]);
                    reqLib.personium.setRequiredKeys([]);
                    reqLib.personium.validateKeys(query);
                    return searchUserProfile(query);
                }
                break;
            case "PUT":
                // Update user information

                // Validate query
                var query = reqLib.personium.parseQuery(request);
                reqLib.personium.setAllowedKeys(["username"]);
                reqLib.personium.setRequiredKeys(["username"]);
                reqLib.personium.validateKeys(query);

                // Validate parameters
                var params = reqLib.personium.parseBody(request);
                reqLib.personium.setAllowedKeys(["customValue", "displayName", "sexId", "birthday", "height", "weight", "selfIntroduction", "profileImage"]);
                reqLib.personium.setRequiredKeys([]);
                reqLib.personium.validateKeys(params);
                
                return updateUserProfile(query.username, params);
                break;
            case "POST":
                // Create user

                // Validate parameters
                var params = reqLib.personium.parseBody(request);
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

// Get one user's profile
function retrieveUserProfile(username) {
    var ret = reqLib.adapterX.getProfileOnUserCell(username);
    return reqLib.personium.createResponse(200, ret);
};

//ユーザ情報検索
function searchUserProfile(cond) {
    var q = reqLib.adapterX.getUsersTableOnSysCell().query();

    if (cond['$top']) {
        q = q.top(cond['$top']);
    }
    if (cond['$skip']) {
        q = q.skip(cond['$skip']);
    }
    if (cond['$orderby']) {
        q = q.orderby(cond['$orderby']);
    }
    if (cond['$filter']) {
        q = q.filter(cond['$filter']);
    }
    var results = q.run();
    return reqLib.personium.createResponse(200, results);
};

//更新
function updateUserProfile(username, info) {
    var results = reqLib.adapterX.updateUserProfile(username, info);

    return {
        status : 204,
        headers : {"Content-Type":"application/json"},
        body: []
    };
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
