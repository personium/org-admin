exports.adapterX = (function() {
    var adapter = adapter || {};

    const USER_CELL_PREFIX = "u-";

    const USER_ACCOUNT_NAME = "me";

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

    adapter.getUsersTableOnSysCell = function () {
        /*
         * Not needed for 1st stage.
         * OData Service Collection of the App Cell this script is running on
         */
        return _p.as('client').cell().box().odata("OData").entitySet("directory");
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

    adapter.getProfileOnUserCell = function(username) {
        // Convert username (xxx) to cellname (u-xxx)
        var cellname = adapter.cellName(username);
        var accInfo = adapter.accInfo.APP_CELL_ADMIN_INFO;
        var userMainBox = _p.as(accInfo).cell(cellname).box("__");
        // Profile JSON
        var jsonStr = userMainBox.getString("profile.json");

        var profile = JSON.parse(jsonStr);
        var ret = {
            displayName: profile.DisplayName,
            selfIntroduction: profile.Description,
            profileImage: profile.Image
        };
        // 各属性
        ret.birthday = _retrieveAttr(userMainBox, "birthday");
        ret.sexId = _retrieveAttr(userMainBox, "sexId");
        ret.customValue = _retrieveAttr(userMainBox, "customValue");
        ret.profileImage = _retrieveAttr(userMainBox, "profileImage");
        ret.height = parseFloat(_retrieveAttr(userMainBox, "height"));
        ret.weight = parseFloat(_retrieveAttr(userMainBox, "weight"));
        ret.displayName = _retrieveAttr(userMainBox, "displayName");
        ret.selfIntroduction = _retrieveAttr(userMainBox, "selfIntroduction");	

//20180420 nakamoto add start
        var ret = [
            "io.personium.client.DaoException: 200,",
            JSON.stringify({
                "d":{
                "results": [{
//20180424 nakamoto mod
                   "displayName": ret.displayName,
                   "birthday": ret.birthday,
                   "customValue": ret.customValue,
                   "sexId": ret.sexId,
                   "weight": ret.weight,
                   "height": ret.height,
                   "selfIntroduction": ret.selfIntroduction,
                   "profileImage": ret.profileImage
                   }]
                   }
            })
        ].join("");
        throw new _p.PersoniumException(ret);
//20180420 nakamoto add end
        
        return ret;
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

    adapter.updateUserProfile = function(username, info) {
        // Convert username (xxx) to cellname (u-xxx)
        var cellname = adapter.cellName(username);
        var accInfo = adapter.accInfo.APP_CELL_ADMIN_INFO;
        var userMainBox = _p.as(accInfo).cell(cellname).box("__");

        /*
         * Not needed for 1st stage.
         * Sysセルの情報を更新
         */
        var directory = adapter.getUsersTableOnSysCell();
        directory.merge(cellname, info, "*");

        // ユーザセルの情報を更新
        var profile = {
            DisplayName: info.displayName,
            Image: info.profileImage,
            Description: info.selfIntroduction,
        };

        /*
         * Must move this routine to the user's cell App Box.
         * Access the installed box inside the user's cell.
         */
        userMainBox.put({
            path: "profile.json",
            data: JSON.stringify(profile),
            contentType: "application/json",
            charset: "utf-8",
            etag: "*"
        });
        _updateAttr(userMainBox, info, "birthday");
        _updateAttr(userMainBox, info, "sexId");
        _updateAttr(userMainBox, info, "customValue");
        _updateAttr(userMainBox, info, "height");
        _updateAttr(userMainBox, info, "weight");
        _updateAttr(userMainBox, info, "selfIntroduction");
        _updateAttr(userMainBox, info, "displayName");
        _updateAttr(userMainBox, info, "profileImage");
        
        return info;
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

        // Box 作成 - 彭さんに仕様（table nameなど）確認
        var box1 = cell.ctl.box.create({Name: "***", Schema:"personium-localunit:/app-***/"});
        var box2 = cell.ctl.box.create({Name: "***", Schema:"personium-localunit:/app-***/"});

        var od1 = box1.mkOData("odata");
        var od2 = box2.mkOData("odata");
        
        box1.odata("odata").schema.entityType.create({Name:"data"});
        box2.odata("odata").schema.entityType.create({Name:"data"});

        // ExtCellとしてsys-sbf登録
        // "personium-localunit:/sys-sbf/"
        var appCellUrl = _p.as('client').cell().getUrl();
        var sysSbfExtCell = cell.ctl.extCell.create({Url: appCellUrl.replace(targetUnitUrl, "personium-localunit:/")});

        // sys-sbfにadminロールを付与
        role.extCell.link(sysSbfExtCell);

        // Directory 登録
        var directory = adapter.getUsersTableOnSysCell();
        directory.create({
            __id: cellname,
            displayName: params.displayName,
            selfIntroduction: params.selfIntroduction,
            birthday: params.birthday,
            sexId: params.sexId,
            height: params.height,
            weight: params.weight
        });

        // ********Get the token of the created cell********
        var cellToken = adapter.getToken(params);

        /* 
         * create rule for logout
         */
        _createLogoutRule(cellname, cellToken.access_token);

        return cellToken;
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
        if (httpCode !== 201) {
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
