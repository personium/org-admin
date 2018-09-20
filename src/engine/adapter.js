exports.adapterX = (function() {
    var adapter = adapter || {};

    const USER_CELL_PREFIX = "***";

    const USER_ACCOUNT_NAME = "***";

    const CREATE_BOX_NAME = "***";
    const CREATE_BOX_SCHEMA_URL = "***";

    const CREATE_ODATA_NAME1 = "***";
    const CREATE_ODATA_NAME2 = "***";

    const CREATE_ODATA_ENTITY_NAME1 = "**";
    const CREATE_ODATA_ENTITY_NAME2 = "**";

    // Personium Unit's and App Cell's authentication information
    adapter.accInfo = require("acc_info").accInfo;

    var _ = require("underscore")._;

    adapter.hasId = function(query) {
        return _.has(query, "id");
    };

    adapter.regUserData = function(username, type, data) {
        if (_.isString(data)) {
            var err = [
                "io.personium.client.DaoException: 400,",
                JSON.stringify({
                    "code": "PR400-EV-0004",
                    "message": {
                        "lang": "en",
                        "value": "[data] field format error."
                    }
                })
            ].join("");
            throw new _p.PersoniumException(err);
        };
        return reqLib.adapter.getDataTableOnUserCell(username, type).create(data);
    };

    adapter.deleteUser = function(username) {
        var cellname = adapter.cellName(username);

        _p.as('client').cell().box().odata("OData").entitySet("directory").del(cellname);

        // ********Get Unit Admin********
        var accJson = adapter.accInfo.UNIT_ADMIN_INFO;
        var accessor = _p.as(accJson);
        var targetUnitUrl = adapter.accInfo.UNIT_URL;
        var unit = accessor.unit(targetUnitUrl);
        unit.ctl.cell.core.recursiveDelete(cellname);
    };

    var _retrieveAttr = function (mainBox, key){
        try {
            return mainBox.getString(key);
        } catch (e) {
            return null;
        }
    };

    adapter.getToken = function(params) {
        // Convert username (xxx) to cellname (u-xxx)
        var cellname = adapter.cellName(params.username);
        var password = params.password;
    
        // ********Get the token of the created cell********
        var accJson = {
            cellUrl: cellname,
            userId: USER_ACCOUNT_NAME,
            password: password
        };
        var createCell = _p.as(accJson).cell(cellname);
        var cellToken = createCell.getToken();

        return cellToken;
    };

    var _updateAttr = function(mainBox, obj, key){
        if (obj[key]) {
            mainBox.put({
                path: key,
                data: obj[key],
                contentType: "text/plain",
                charset: "utf-8",
                etag: "*"
            });
        }
    };

    adapter.createUser = function(params) {
        var cellname = adapter.cellName(params.username);

        // ********Get Unit Admin********
        var accJson = adapter.accInfo.UNIT_ADMIN_INFO;
        var accessor = _p.as(accJson);
        var targetUnitUrl = adapter.accInfo.UNIT_URL;
        var unit = accessor.unit(targetUnitUrl);
        
        // ********Create Cell********
        var cell = unit.ctl.cell.create({Name: cellname});

        // ********Create admin account********
        var user = {"Name": USER_ACCOUNT_NAME};
        var acc = cell.ctl.account.create(user, params.password);

        // ********Create admin role********
        var roleJson = {
            "Name": "admin"
        };
        var role = cell.ctl.role.create(roleJson);

        // ********Assign roles to account********
        role.account.link(acc);

        // ********Set all authority admin role********
        var param = {
            'ace': [{'role': role, 'privilege':['root']}]
        };
        cell.acl.set(param);

        // create Box
        var box1 = cell.ctl.box.create({Name: CREATE_BOX_NAME, Schema:CREATE_BOX_SCHEMA_URL});

        // create odata
        var od1 = box1.mkOData(CREATE_ODATA_NAME1);
        var od2 = box1.mkOData(CREATE_ODATA_NAME2);
        // create EntityType
        box1.odata(CREATE_ODATA_NAME1).schema.entityType.create({Name:CREATE_ODATA_ENTITY_NAME1});
        box1.odata(CREATE_ODATA_NAME2).schema.entityType.create({Name:CREATE_ODATA_ENTITY_NAME2});
        // create Property for Entity Type1
        box1.odata(CREATE_ODATA_NAME1).schema.property.create({Name:"UserId","_EntityType.Name":CREATE_ODATA_ENTITY_NAME1,Type:"Edm.Int32",Nullable:false,DefaultValue:0});
        // create Property for Entity Type 2
        box1.odata(CREATE_ODATA_NAME2).schema.property.create({Name:"UserId","_EntityType.Name":CREATE_ODATA_ENTITY_NAME2,Type:"Edm.Int32",Nullable:false,DefaultValue:0});

        
        var roleOwner = cell.ctl.role.create({Name: "Owner","_Box.Name": CREATE_BOX_NAME});
        var roleEditor = cell.ctl.role.create({Name: "Editor","_Box.Name": CREATE_BOX_NAME});
        var roleViewer = cell.ctl.role.create({Name: "Viewer","_Box.Name": CREATE_BOX_NAME});

        // ********Get the token of the created cell********
        var cellToken = adapter.getToken(params);

        /* 
         * create rule for logout
         */
        _createLogoutRule(cellname, cellToken.access_token);

        // Set permissions for created OData
        _setODataAcl(cellname, CREATE_ODATA_NAME1, cellToken.access_token);
        _setODataAcl(cellname, CREATE_ODATA_NAME2, cellToken.access_token);

        return cellToken;
    };

    var _setODataAcl = function(cellname, odataname, token) {
        var headers = {
            "Accept": "application/json",
            "Authorization": "Bearer " + token,
            "X-HTTP-Method-Override": "ACL"
        };
        var url = adapter.accInfo.UNIT_URL + cellname + "/" + CREATE_BOX_NAME + "/" + odataname;
        var body = [
            "<?xml version=\"1.0\" encoding=\"utf-8\" ?>",
                "<D:acl xmlns:p=\"urn:x-personium:xmlns\" xmlns:D=\"DAV:\" xml:base=\"" + adapter.accInfo.UNIT_URL + cellname + "/__role/" + CREATE_BOX_NAME + "/\">",
                    "<D:ace>",
                        "<D:principal>",
                            "<D:href>Owner</D:href>",
                        "</D:principal>",
                        "<D:grant>",
                            "<D:privilege>",
                                "<p:all/>",
                            "</D:privilege>",
                        "</D:grant>",
                    "</D:ace>",
                    "<D:ace>",
                        "<D:principal>",
                            "<D:href>Editor</D:href>",
                        "</D:principal>",
                        "<D:grant>",
                            "<D:privilege>",
                                "<p:write/>",
                            "</D:privilege>",
                        "</D:grant>",
                    "</D:ace>",
                    "<D:ace>",
                        "<D:principal>",
                            "<D:href>Viewer</D:href>",
                        "</D:principal>",
                        "<D:grant>",
                            "<D:privilege>",
                                "<p:read/>",
                            "</D:privilege>",
                        "</D:grant>",
                    "</D:ace>",
                "</D:acl>"
        ].join("");
        var contentType = "application/json";

        return _httpPOSTMethod(url, headers, contentType, body);
    };

    var _createLogoutRule = function(cellname, token) {
        var url = [
            adapter.accInfo.UNIT_URL,
            cellname,
            "/__ctl/Rule"
        ].join("");
        var headers = {
            "Accept": "application/json",
            "Authorization": "Bearer " + token
        };
        var contentType = "application/json";
        var body = JSON.stringify({"Name":"logout", "EventExternal":true, "EventType":"logout", "Action":"log"});
        
        return _httpPOSTMethod(url, headers, contentType, body);
        // return _httpPOSTMethodHack(url, headers, contentType, body);
    };

   /*
    * For latest HTTP Client Plugin
    */
    var _httpPOSTMethod = function(url, headers, contentType, body) {
        var httpClient = new _p.extension.HttpClient();
        var response = httpClient.post(url, headers, contentType, body);
        var httpCode = parseInt(response.status);
        if (httpCode !== 201 && httpCode !== 200) {
            // Personium exception
            var err = [
                "io.personium.client.DaoException: ",
                httpCode,
                ",",
                response.body
            ].join("");
            throw new _p.PersoniumException(err);
        }
        return response;
    };

    /*
     * For older version of HTTP Client Plugin
     */
    var _httpPOSTMethodHack = function(url, headers, contentType, body) {
        // Hack Ver
        var dcx = {sports: {HTTP: {}}};
        var __a = new Packages.io.personium.client.PersoniumContext(pjvm.getBaseUrl(), pjvm.getCellName(), pjvm.getBoxSchema(), pjvm.getBoxName()).withToken(null);
        dcx.sports.HTTP._ra = Packages.io.personium.client.http.RestAdapterFactory.create(__a);
        var formatRes = function(dcr) {
            var resp = {body: "" + dcr.bodyAsString(), status: dcr.getStatusCode(), headers: {}};
            return resp;
        };

        // post 
        dcx.sports.HTTP.post = function(url, body, contentType, headers) {
            if (!headers) {
                headers = {"Accept": "text/plain"};
            }
            var dcr = dcx.sports.HTTP._ra.post(url, dc.util.obj2javaJson(headers), body, contentType);
            return formatRes(dcr);
        };

        try {
            var response = dcx.sports.HTTP.post(url, body, contentType, headers);
        } catch(e) {
            if (e.message) {
                throw new _p.PersoniumException(e.message);
            } else {
                throw(e);
            }
        }
        var httpCode = response.status;
        if (response === null || httpCode !== 201) {
            // Personium exception
            var err = [
                "io.personium.client.DaoException: ",
                httpCode,
                ",",
                response.body
            ].join("");
            throw new _p.PersoniumException(err);
        }

        return response;
    };

    adapter.getDataTableOnUserCell = function(username, type) {
        // OData Service Collection
        var cellname = adapter.cellName(username);
        var accInfo = adapter.accInfo.APP_CELL_ADMIN_INFO;
        return _p.as(accInfo).cell(cellname).box(type).odata("odata").entitySet("data");
    };

    adapter.resetPassword = function(username, password) {
        var cellname = adapter.cellName(username);
        var accInfo = adapter.accInfo.APP_CELL_ADMIN_INFO;
        return _p.as(accInfo).cell(cellname).ctl.account.changePassword(USER_ACCOUNT_NAME, password);
    };

    adapter.cellName = function(username) {
        return USER_CELL_PREFIX + username;
    };
    
    return adapter;
}());
