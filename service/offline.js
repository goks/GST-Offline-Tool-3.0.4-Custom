/**
*  @author:   Prakash Kaphle
*  @created:   Sep 2016
*  @description: Offline Tool
*  @copyright: (c) Copyright by Infosys technologies
*  version GST 3.0.4
*  Last Updated:  Prakash Kaphle, Dec 01 2020
**/

'use strict';
var express = require('express');
var extend = require('node.extend');
var router = express.Router();
var fs = require('fs');
var bodyParser = require('body-parser');
router.use(bodyParser.json());
var mkdirp = require('mkdirp');
var _ = require('lodash');
var del = require('delete');
var AdmZip = require('adm-zip');
var filepath = "No File Found";
var omitEmpty = require('omit-empty');
var errorConstant = require('../utility/errorconstants');
var common = require('../utility/common');
var angular = require('../utility/angularHelper'); //ADDITION BY V
var ReturnStructure = require('../utility/returnStructure'); //ADDITION BY V
var controlFiledir = './public/userData/';
var uploadedFiledir = './public/upload/';
var uploadedImpFiledir = './public/download/';
var uploadedErrdir = './public/error/';
var log = require('../utility/logger');
var response = require('../utility/response');
var logger = log.logger;
var async = require('async');
var _ = require('underscore');
const NodeCache = require("node-cache");
var path = require('path');
var jsonSize = require('json-size');
const { isUndefined, forEach } = require('underscore');
var max_size = 4.7 * 1024 * 1024;
var newHSNStartDateConstant = '052021';

// for finding an object in a array .
Array.prototype.myFind = function (obj) {
    return this.filter(function (item) {

        for (var prop in obj)
            if (!(prop in item) || (obj[prop] !== item[prop])) {
                if (prop in item && typeof obj[prop] == 'string' && prop == 'inum') {
                    if ((obj[prop]).toLowerCase() === (item[prop]).toLowerCase()) {
                        return true;
                    }
                }
                return false;
            }
        return true;
    });
};


function removeUnEssentialKeys(file, form) {
    if (form == 'GSTR1A') {
        for (var key in file) {
            if (file[key].constructor === Array)
                switch (key) {
                    case 'b2b':
                        for (var i = 0; i < file[key].length; i++) {
                            for (var j = 0; j < file[key][i].inv.length; j++) {
                                var invoice = file[key][i].inv[j];
                                delete invoice.cflag;
                                delete invoice.inv_typ;
                                delete invoice.itms;
                                delete invoice.pos;
                                delete invoice.rchrg;
                                delete invoice.val;
                                delete invoice.updby;
                            }
                        }
                        break;
                    case 'cdn':
                    case 'cdnr':
                        for (var i = 0; i < file[key].length; i++) {
                            for (var j = 0; j < file[key][i].nt.length; j++) {
                                var invoice = file[key][i].nt[j];
                                delete invoice.ntty;
                                delete invoice.p_gst;
                                delete invoice.rsn;
                                delete invoice.updby;
                                delete invoice.itms;
                                delete invoice.cflag;
                                delete invoice.val;
                            }
                        }
                        break;
                    default:
                        break;
                }
        }
    } else if (form == 'GSTR1') {
        for (var key in file) {
            switch (key) {
                case 'b2cl':
                case 'b2cla':
                    for (var i = 0; i < file[key].length; i++) {
                        for (var j = 0; j < file[key][i].inv.length; j++) {
                            var invoice = file[key][i].inv[j];
                            if (invoice.inv_typ)
                                delete invoice.inv_typ;
                        }
                    }
                    break;
                case 'exp':
                case 'expa':
                    for (var i = 0; i < file[key].length; i++) {
                        for (var j = 0; j < file[key][i].inv.length; j++) {
                            var invoice = file[key][i].inv[j];
                            if (invoice.diff_percent)
                                delete invoice.diff_percent;
                        }
                    }
                    break;
                default:
                    break;
            }
        }
    }
    return file;
}

function saveMstrforprod(req, res, err) {
    var mstrData = req.body.savemstr;
    var gstin = req.body.gstin;
    var rectype = req.body.recType;
    try {
        var fileData = fs.readFileSync(__dirname + '/../public/userData/master_' + gstin + '.json', "utf8");
        fileData = JSON.parse(fileData);
        var pMaster = (rectype == "productsMasters") ? mstrData : fileData.productsMasters;
        var sMaster = (rectype == "supplierRecipientMasters") ? mstrData : fileData.supplierRecipientMasters;
        fileData.productsMasters = pMaster;
        fileData.supplierRecipientMasters = sMaster;
        try {
            fs.writeFileSync(__dirname + '/../public/userData/master_'
                + gstin + '.json', JSON.stringify(fileData));
            res.send(fileData);
        } catch (err) {
            logger.log("error", "exception while saving the file..");
            res.status(404).end();
        }

    } catch (err) {
        // logger.log("error", "NO JSON FILE EXISTS FOR SELECTION");
        // res.status(404).end();
        var pMaster = (rectype == "productsMasters") ? mstrData : [];
        var sMaster = (rectype == "supplierRecipientMasters") ? mstrData : [];
        var fileData = {
            "userGstin": gstin,
            "productsMasters": pMaster,
            "supplierRecipientMasters": sMaster
        }
        try {
            fs.writeFileSync(__dirname + '/../public/userData/master_'
                + gstin + '.json', JSON.stringify(fileData));
            res.send(fileData);
        } catch (err) {
            logger.log("error", "exception while saving the file..");
            res.status(404).end();
        }

    }
}

function getMasterData(req, res) {
    var gstin = req.body.gstin;
    try {
        var fileData = fs.readFileSync(__dirname + '/../public/userData/master_' + gstin + '.json', "utf8");
        fileData = JSON.parse(fileData);
        res.send(fileData);
    } catch (err) {

        logger.log("error", "NO JSON FILE EXISTS FOR SELECTION");
        res.status(404).end();
    }
}

// ADDITION  BY V START

function findWithinStructure(data, section, sub_section, to_be_checked) {

    switch (section) {

        case 'b2b':
        case 'b2ba':
        case 'b2cl':
        case 'b2cla':
        case 'cdn':
        case 'cdnr':
        case 'cdnra':
        case 'exp':
        case 'expa':
            var sec_data = data[section];

            if (sec_data === undefined && section == 'cdnr') {
                sec_data = data['cdn']; // gstr 2 - import
            } else if (sec_data === undefined && section == 'cdnra') {
                sec_data = data['cdna']; // gstr - 2 ammendments
            }

            // normalization done, if still undefined , return no
            if (sec_data === undefined) {
                return 'no';
            }

            var ctins = sec_data.length;

            var invs;
            var tmp;
            var key;
            var val;
            for (var k = 0; k < to_be_checked.length; k++) {
                key = to_be_checked[k].key;
                val = to_be_checked[k].value;

                for (var i = 0; i < ctins; i++) {
                    tmp = sec_data[i][sub_section];
                    invs = sec_data[i][sub_section].length || 0;
                    for (var j = 0; j < invs; j++) {
                        if ((tmp[j][key]).toLowerCase() == val.toLowerCase())
                            return 'yes';
                    }
                }
            }

            break;
        case 'cdnur':
        case 'cdnura':
        case 'at':
        case 'adadj':

        case 'txi':
        case 'txpd':
            var sec_data = data[section];
            // normalization done, if still undefined , return no
            if (sec_data === undefined) {
                return 'no';
            }

            var ctins = sec_data.length;

            var invs;
            var tmp;
            var key;
            var val;
            for (var k = 0; k < to_be_checked.length; k++) {
                key = to_be_checked[k].key;
                val = to_be_checked[k].value;
                for (var i = 0; i < ctins; i++) {
                    tmp = sec_data[i];
                    if (tmp[key] && (tmp[key]).toLowerCase() == val.toLowerCase())
                        return 'yes';
                }
            }

            break;
    }
    return 'no';
}

function itemExists(req, res) {
    logger.log("info", "Entering Offline js:: itemExists ");
    var sec = req.body.tbl_cd;

    var invdltArray = req.body.invdltArray;

    var key = req.body.key;
    var val = req.body.value;

    var to_be_checked = [];
    to_be_checked = [{ key: key, value: val }];
    var file_name = req.body.fName;


    var gstin = req.body.gstin;
    var form = req.body.form;
    var fy = req.body.fy;
    var month = req.body.month;
    if (!file_name) {
        var dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month;
        var filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json';
    } else {
        var filename = __dirname + '/../public/' + file_name;
    }

    if (!sec || to_be_checked.length < 0) {
        res.status(200).send({ 'result': 'no', 'reason': 'all_parameters_not_provided' });
        return;
    }
    if (!fs.existsSync(filename)) {
        res.status(200).send({ 'result': 'no' });
        return;
    }
    var fileData = fs.readFileSync(filename, "utf8");
    fileData = JSON.parse(fileData);
    var result;
    switch (sec) {
        case 'b2b':
        case 'b2ba':
        case 'b2cla':
        case 'b2cl':
        case 'exp':
        case 'expa':
            result = findWithinStructure(fileData, sec, 'inv', to_be_checked);
            break;
        case 'cdn':
        case 'cdnr':
        case 'cdnra':
            result = findWithinStructure(fileData, sec, 'nt', to_be_checked);
            break;
        case 'cdnur':
        case 'cdnura':
        case 'at':
        case 'adadj':

        case 'txi':
        case 'txpd':
            result = findWithinStructure(fileData, sec, null, to_be_checked);
            break;

    }
    if (result == 'yes') {
        res.status(200).send({ 'result': 'yes' })
    } else {
        res.status(200).send({ 'result': 'no' })
    }
    return;
}

function listJsonData(req, res) {

    logger.log("info", "Entering Offline js:: listJsonData ");
    var sec = req.body.section;
    var page = req.body.page_num;
    if (!page) page = 1;
    var page_count = 25;
    var file = req.body.file;
    var filter = req.body.filter;
    var formName = req.body.form;
    if (formName == 'GSTR2' && sec == 'hsn') {
        sec = 'hsnsum';
    }
    var shareData = req.body.shareData;
    var sort_by = req.body.sort_by;
    var sort_order = req.body.sort_order;

    try {
        var fileData = fs.readFileSync(__dirname + '/../public/' + file, "utf8");

        fileData = JSON.parse(fileData);
        var gstin = fileData.gstin;

        if (formName == "GSTR2" && sec == 'nil')
            sec = 'nil_supplies';
        if (sec == 'atadj') {
            var sec2 = 'txpd';
        }
        else if (sec == 'cdnr') {
            var sec2 = 'cdn';
        }
        else if (sec == 'cdnra') {
            var sec2 = 'cdna';
        }
        else if (sec == 'atadja') {
            var sec2 = 'txpda';
        } else
            var sec2 = '';



        if (typeof fileData[sec] == 'object' || (sec2 != '' && typeof fileData[sec2] == 'object')) {


            if (typeof fileData[sec] != 'object') {

                sec = sec2;
            }
            fileData = fileData[sec];
            if (sec == 'nil' || sec == 'nil_supplies' || sec == "itc_rvsl" || sec == "doc_issue") {
                if (sec == 'itc_rvsl' && typeof fileData.length != 'undefined') {

                    var tmp = {}
                    if (typeof fileData.length !== 'undefined') {
                        fileData.forEach(function (item) {
                            var key = Object.keys(item)[0];  //take the first key from every object in the array
                            tmp[key] = item[key];   //assign the key and value to output obj
                        });
                        fileData = tmp;
                    }


                }

                if (sec == 'itc_rvsl') {

                    delete fileData.chksum;

                }

                if (Object.keys(fileData).length === 0 && fileData.constructor === Object) {

                    res.status(404).end();

                } else {

                    res.status(200).send(JSON.stringify(fileData));
                }
                return;



            } else if (sec === "hsn") {
                fileData = fileData.data;
            } else if (sec === "hsnsum") {
                fileData = fileData.det;
            }


            var reformateInv = ReturnStructure.reformateInv(ReturnStructure.scopelists.suplyList, gstin, sec, formName, false, shareData);
            var formateNodePayload = ReturnStructure.formateNodePayload(sec, formName, shareData);
            var getInv = ReturnStructure.getInv(sec, formName, shareData);


            var seperateResponse = function (iResp) {

                var reformedResp = reformateInv(iResp);
                var uploadBySuplrList = [],
                    uploadbyRcvrList = [],
                    modifiedByRcvrList = [],
                    rejectedByRcvrList = [];
                angular.forEachCustom(reformedResp, function (inv, i) {
                    //Added by Subrat for GSTR1 2nd flow - 4 tabs S0512
                    if (formName == 'GSTR1' && req.body.fl == 'FL2') {
                        if ((!inv.updby || inv.updby == 'S') && (inv.cflag != 'R') && (!inv.flag || inv.flag == 'U' || inv.flag == 'E' || inv.flag == 'D' || inv.flag == 'N')) {
                            uploadBySuplrList.push(inv);
                        } else if (inv.updby == 'R' && inv.cflag == 'U') {
                            uploadbyRcvrList.push(inv);
                        } else if (inv.updby == 'R' && inv.cflag == 'M') {
                            modifiedByRcvrList.push(inv);
                        } else if (inv.updby == 'S' && (inv.cflag == 'R' || inv.cflag == 'FR')) {
                            rejectedByRcvrList.push(inv);
                        }
                    }
                    //End of S0512
                    else if (formName == 'GSTR1' && inv.updby == 'R') {
                        uploadbyRcvrList.push(inv);
                    } else if (formName == 'GSTR2' && (inv.updby == 'S' || inv.flag == 'M')) {
                        uploadBySuplrList.push(inv);
                    } else if (formName == 'GSTR1' && (!inv.updby || inv.updby == 'S')) {
                        uploadBySuplrList.push(inv);
                    } else if (formName == 'GSTR2' && (!inv.updby || inv.updby == 'R')) {
                        uploadbyRcvrList.push(inv);
                    }

                });
                if (formName == 'GSTR1' && req.body.fl == 'FL2') {
                    return {
                        uploadbyRcvrData: uploadbyRcvrList,
                        uploadBySuplrData: uploadBySuplrList,
                        modifiedByRcvrData: modifiedByRcvrList,
                        rejectedByRcvrData: rejectedByRcvrList
                    }
                } else {
                    return {
                        uploadbyRcvrData: uploadbyRcvrList,
                        uploadBySuplrData: uploadBySuplrList
                    }
                }
            }
            if (req.body.fl && req.body.fl == 'FL2' && (sec == "b2b" || sec == "cdnr" || sec == "cdn" || sec == "cdna" || sec == "b2ba" || sec == "cdnra" || sec == "impg" || sec == "impgsez") && shareData.isUploadFlag) {

                var formateResponse = seperateResponse(fileData);
                if (shareData.isUploadFlag == 'R') {
                    fileData = formateResponse.uploadbyRcvrData;
                } else if (shareData.isUploadFlag == 'Modified') {
                    fileData = formateResponse.modifiedByRcvrData;
                } else if (shareData.isUploadFlag == 'Rejected') {
                    fileData = formateResponse.rejectedByRcvrData;
                }
                else {
                    fileData = formateResponse.uploadBySuplrData;
                }
            } else {

                fileData = reformateInv(fileData);

            }



            if (filter && filter.trim() !== '')
                fileData = angular.searchFor(filter, fileData);
            var fileDataMeta = fileData.length;

            if (sort_by && sort_by !== '') {
                if (sort_order) {
                    fileData.sort(function (a, b) {
                        var nameA = isUndefined(a[sort_by]) ? '' : a[sort_by];
                        var nameB = isUndefined(b[sort_by]) ? '' : b[sort_by];

                        if (nameA < nameB) {
                            return -1;
                        }
                        if (nameA > nameB) {
                            return 1;
                        }
                        return 0;
                    });
                } else {
                    //reverse
                    fileData.sort(function (a, b) {
                        var nameA = isUndefined(a[sort_by]) ? '' : a[sort_by];
                        var nameB = isUndefined(b[sort_by]) ? '' : b[sort_by];

                        if (nameA < nameB) {
                            return 1;
                        }
                        if (nameA > nameB) {
                            return -1;
                        }
                        return 0;
                    });
                }
            }


            fileData = fileData.slice((page - 1) * page_count, (page_count * page));

            res.status(200).send(JSON.stringify({
                rows: fileData,
                count: fileDataMeta
            }));
        } else {
            logger.log("info", "no data for section in  json file");
            res.status(404).end();
        }
    } catch (err) {
        console.log(err);
        logger.log("info", "NO JSON FILE EXISTS FOR SELECTION");
        res.status(404).end();
    }

}

function fetchMeta(req, res) {
    logger.log("info", "Entering Offline js:: fetchMeta ");
    var errorObject;
    try {
        var fileName = req.body.fName;
        var form = req.body.form;
        var jSonfileName = __dirname + '/../public/' + fileName + '_meta.json';
        var payloadfileName = __dirname + '/../public/' + fileName + '.json';
        payloadfileName = payloadfileName.replace('.json.json', '.json');
        jSonfileName = jSonfileName.replace('.json_meta.json', '_meta.json');
        jSonfileName = jSonfileName.replace('.json.json', '.json');
        var payload = fs.readFileSync(payloadfileName, "utf8");
        payload = JSON.parse(payload);

        update_meta_file(payloadfileName, payload, form, function (err) {
            if (err) {
                errorObject = {
                    statusCd: errorConstant.STATUS_500,
                    errorCd: errorConstant.STATUS_500,
                };
                logger.log("error", "Unexpected Error whilecreating summary :: %s", err.message);
                response.error(errorObject, res);
                return;
            } else {
                payload = fs.readFileSync(jSonfileName, "utf8");
                payload = JSON.parse(payload);
                response.success(payload, res);
            }

        });
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected Error while generating file :: %s", err.message)
        response.error(errorObject, res);
    } finally {
        errorObject = null;

    }

}

function fixUQC(file_data) {

    if (!file_data || (!file_data.hsn) || !file_data.hsn.data) {
        return file_data;
    }
    var data_length = file_data.hsn.data.length;
    for (var i = 0; i < data_length; i++) {
        file_data.hsn.data[i].uqc = (typeof file_data.hsn.data[i].uqc == 'string' && file_data.hsn.data[i].uqc != '') ? (((file_data.hsn.data[i].uqc.split('-'))[0]).trim()) : file_data.hsn.data[i].uqc;
    }
    return file_data;
}

function fixFlag(file) {

    for (var key in file) {
        var value = file[key];
        var newValue = [];
        if (value && value.constructor == Array)
            switch (key) {
                case "b2b":
                case "b2ba":

                    for (var i = 0; i < value.length; i++) {

                        for (var index = 0; index < value[i].inv.length; index++) {

                            if (value[i].inv[index].flag == "M") {


                                delete value[i].inv[index]["flag"];

                            }
                        }
                        newValue.push(value[i]);
                    }
                    file[key] = newValue;

                    break;
                case "b2cl":
                case "b2cla":

                    for (var i = 0; i < value.length; i++) {

                        for (var index = 0; index < value[i].inv.length; index++) {

                            if (value[i].inv[index].flag == "M") {


                                delete value[i].inv[index]["flag"];

                            }
                        }
                        newValue.push(value[i]);
                    }
                    file[key] = newValue;

                    break;
                case "b2cs":
                case "b2csa":
                    for (var i = 0; i < value.length; i++) {
                        if (value[i].flag == "M") {

                            delete value[i]['flag'];

                        }
                        newValue.push(value[i]);
                    }

                    file[key] = newValue;
                    break;
                case "cdnr":
                case "cdnra":

                    for (var i = 0; i < value.length; i++) {

                        for (var index = 0; index < value[i].nt.length; index++) {

                            if (value[i].nt[index].flag == "M") {


                                delete value[i].nt[index]["flag"];

                            }
                        }
                        newValue.push(value[i]);
                    }
                    file[key] = newValue;

                    break;
                case "cdnur":
                    for (var i = 0; i < value.length; i++) {
                        if (value[i].flag == "M") {

                            delete value[i]['flag'];

                        }
                        newValue.push(value[i]);
                    }

                    file[key] = newValue;
                    break;
                case "at":
                case "ata":
                    for (var i = 0; i < value.length; i++) {
                        if (value[i].flag == "M") {

                            delete value[i]['flag'];

                        }
                        newValue.push(value[i]);
                    }

                    file[key] = newValue;

                    break;
                case "txpd":
                    for (var i = 0; i < value.length; i++) {
                        if (value[i].flag == "M") {

                            delete value[i]['flag'];

                        }
                        newValue.push(value[i]);
                    }

                    file[key] = newValue;

                    break;
                case "exp":
                case "expa":

                    for (var i = 0; i < value.length; i++) {

                        for (var index = 0; index < value[i].inv.length; index++) {

                            if (value[i].inv[index].flag == "M") {


                                delete value[i].inv[index]["flag"];

                            }
                        }
                        newValue.push(value[i]);
                    }
                    file[key] = newValue;

                    break;
            }


    }
    return file;
}

function deleteSec(file) {

    for (var key in file) {
        if (key == 'backups') {
            delete file[key];
        }

    }
    return file;
}

function sbnumInt(exports) {


    if (!exports || !exports.length) {
        return exports;
    }
    var tmp_len;
    for (var i = 0; i < exports.length; i++) {
        if (exports[i].inv && exports[i].inv.length) {
            tmp_len = exports[i].inv.length
            for (var j = 0; j < tmp_len; j++) {
                if (exports[i].inv[j].sbnum)
                    exports[i].inv[j].sbnum = parseInt(exports[i].inv[j].sbnum);
            }
        }
    }
    return exports;
}

function removePOS(data, type) {
    if (!data || !data.length)
        return data;

    if (type == 'cdnr' || type == 'cdnra') {
        var cdnrLen = data.length;
        for (var i = 0; i < cdnrLen; i++) {
            var noteLen = data[i].nt.length;
            if (data[i].nt && noteLen) {
                for (var j = 0; j < noteLen; j++) {
                    //changes for CDN delinking start
                    if (data[i].nt[j].p_gst)
                        delete data[i].nt[j].p_gst;

                    if (data[i].nt[j].inum)
                        delete data[i].nt[j].inum

                    if (data[i].nt[j].idt)
                        delete data[i].nt[j].idt

                    if (data[i].nt[j].d_flag)
                        delete data[i].nt[j].d_flag

                    if (data[i].nt[j].updby)
                        delete data[i].nt[j].updby

                    if (data[i].nt[j].cflag)
                        delete data[i].nt[j].cflag

                    if (data[i].nt[j].opd)
                        delete data[i].nt[j].opd

                    if (data[i].nt[j].chksum)
                        delete data[i].nt[j].chksum
                    //changes for CDN delinking end
                }
            }
        }
        return data;
    } else if (type == "cdnur" || type == "cdnura") {
        var cdnurLen = data.length;
        for (var j = 0; j < cdnurLen; j++) {
            //changes for CDN delinking start
            if (data[j].p_gst)
                delete data[j].p_gst;

            if (data[j].inum)
                delete data[j].inum

            if (data[j].idt)
                delete data[j].idt

            if (data[j].d_flag)
                delete data[j].d_flag

            if (data[j].updby)
                delete data[j].updby
            //changes for CDN delinking end
            if (data[j].old_ntnum)
                delete data[j].old_ntnum;
            if (data[j].old_inum)
                delete data[j].old_inum;
        }
        return data;
    }
    return data;
}
function removeCName(data, type) {
    if (!data || !data.length)
        return data;

    if (type == 'cdnr' || type == 'cdnra' || type == 'b2ba' || type == 'b2b') {
        for (var i = 0; i < data.length; i++) {
            if (data[i].cname) {
                delete data[i].cname;
            }

        }
        return data;

    }
}
function fixPOS(data, type) {

    if (!data || !data.length)
        return data;

    if (type == 'b2cs' || type == 'b2csa') {
        for (var i = 0; i < data.length; i++) {
            if (data[i].sply_ty && data[i].sply_ty.name) {
                data[i].sply_ty = data[i].sply_ty.name;
            }
            if (data[i].sply_ty.toLowerCase() == 'inter-state') {
                data[i].sply_ty = 'INTER';
            } else if (data[i].sply_ty.toLowerCase() == 'intra-state') {
                data[i].sply_ty = 'INTRA';
            }
            if (data[i].iamt) data[i].iamt = parseFloat(data[i].iamt);
            if (data[i].csamt) data[i].csamt = parseFloat(data[i].csamt);
            if (data[i].camt) data[i].camt = parseFloat(data[i].camt);
            if (data[i].samt) data[i].samt = parseFloat(data[i].samt);

        }
        return data;
    }

    return data; // fallback
}

function fixDoc(data) {
    var tbldata = null;

    if (!data || !data.length) {
        return data;
    } else {
        tbldata = data.doc_det;
    }



    for (var index = 0; index < tbldata.length; index++) {
        if (!tbldata[index].hasOwnProperty("docs")) {
            tbldata.splice(index, 1);
        }
        else {
            delete tbldata[index].doc_typ;
        }

    }
    return data;
}

function fixOldNum(data, type) {

    if (!data || (type != 'hsn' && !data.length))
        return data;

    if (type == 'b2cla' || type == 'b2cl' || type == 'b2ba' || type == 'b2b' || type == 'expa') {
        for (var i = 0; i < data.length; i++) {
            if (data[i].inv && data[i].inv.length) {
                for (var j = 0; j < data[i].inv.length; j++) {
                    delete data[i].inv[j].old_inum;
                    delete data[i].inv[j].opd;
                }
            }
        }
    }
    else
        if (type == 'cdnra' || type == 'cdnr') {
            for (var i = 0; i < data.length; i++) {
                if (data[i].nt && data[i].nt.length) {
                    for (var j = 0; j < data[i].nt.length; j++) {
                        delete data[i].nt[j].old_inum;
                        delete data[i].nt[j].old_ntnum;
                        delete data[i].nt[j].opd;
                    }
                }
            }
        } else if (type == 'cdnura' || type == 'cdnur') {
            for (var i = 0; i < data.length; i++) {
                if (data[i].old_inum)
                    delete data[i].old_inum;
                if (data[i].old_ntnum)
                    delete data[i].old_ntnum;

            }
        }
        else
            if (type == 'hsn' && data.data) {

                for (var i = 0; i < data.data.length; i++) {

                    data.data[i].val = parseFloat(data.data[i].val);
                    data.data[i].val = parseFloat(data.data[i].val);

                }
            }
    return data;

}
//Added by Subrat to remove diffVal field - 65% related CR
function fixDiffVal(data, type) {
    if (!data)
        return data;


    if (type == 'b2cla' || type == 'b2cl' || type == 'b2ba' || type == 'b2b' || type == 'expa' || type == 'exp') {
        for (var i = 0; i < data.length; i++) {
            if (data[i].inv && data[i].inv.length) {
                for (var j = 0; j < data[i].inv.length; j++) {
                    delete data[i].inv[j].diffval;
                    if (data[i].inv[j].diff_percent) {
                        data[i].inv[j].diff_percent = +data[i].inv[j].diff_percent
                        if (data[i].inv[j].diff_percent != 0.65)
                            delete data[i].inv[j].diff_percent
                    }
                    if ((type == 'b2cla' || type == 'b2cl') && data[i].inv[j].inv_typ != 'CBW')
                        delete data[i].inv_typ;
                }
            }
        }
    }
    else if (type == 'b2cs' || type == 'b2csa' || type == 'cdnur' || type == 'cdnura' || type == 'at' || type == 'ata' || type == 'txpd' || type == 'txpda') {

        for (var i = 0; i < data.length; i++) {

            delete data[i].diffval;
            if (data[i].diff_percent) {

                data[i].diff_percent = +data[i].diff_percent;
                if (data[i].diff_percent != 0.65)
                    delete data[i].diff_percent;
            }
            delete data[i].inv_typ;
        }
    }
    else if (type == 'cdnra' || type == 'cdnr') {
        for (var i = 0; i < data.length; i++) {
            if (data[i].nt && data[i].nt.length) {
                for (var j = 0; j < data[i].nt.length; j++) {
                    delete data[i].nt[j].diffval;
                    if (data[i].nt[j].diff_percent) {
                        data[i].nt[j].diff_percent = +data[i].nt[j].diff_percent;
                        if (data[i].nt[j].diff_percent != 0.65)
                            delete data[i].nt[j].diff_percent;
                    }
                    delete data[i].inv_typ;
                }
            }
        }
    }
    return data;

}
function generateTotal(total, itmInner, iSec, InnerInv, typ) {
    //condition for SEWOP added by Janhavi
    if (typ == "SEWOP" && (iSec == "b2b" || iSec == "b2ba" || iSec == "cdnr" || iSec == "cdnra")) {
        itmInner.iamt = 0;
        itmInner.csamt = 0;
    }
    else if (typ == "WOPAY" && (iSec == "exp" || iSec == "expa")) {
        itmInner.iamt = 0;
        itmInner.csamt = 0;
    }
    else if (typ == "EXPWOP" && (iSec == "cdnur" || iSec == "cdnura")) {
        itmInner.iamt = 0;
        itmInner.csamt = 0;
    }
    // for some cases, it is string, so toFixed causes issue, should be a number.
    if (typeof itmInner.camt == 'string')
        itmInner.camt = parseFloat(itmInner.camt);
    if (typeof itmInner.samt == 'string')
        itmInner.samt = parseFloat(itmInner.samt);
    if (typeof itmInner.iamt == 'string')
        itmInner.iamt = parseFloat(itmInner.iamt);
    if (typeof itmInner.csamt == 'string')
        itmInner.csamt = parseFloat(itmInner.csamt);
    if (iSec == "cdnr" || iSec == "cdnur" || iSec == "cdnra" || iSec == "cdnura") {

        if (InnerInv == "C" || InnerInv == "R") {

            total.cgTl -= (itmInner.camt) ? parseFloat((itmInner.camt).toFixed(2)) : 0;
            total.sgTl -= (itmInner.samt) ? parseFloat((itmInner.samt).toFixed(2)) : 0;
            total.igTl -= (itmInner.iamt) ? parseFloat((itmInner.iamt).toFixed(2)) : 0;
            total.csTl -= (itmInner.csamt) ? parseFloat((itmInner.csamt).toFixed(2)) : 0;
        } else {

            total.cgTl += (itmInner.camt) ? parseFloat((itmInner.camt).toFixed(2)) : 0;
            total.sgTl += (itmInner.samt) ? parseFloat((itmInner.samt).toFixed(2)) : 0;
            total.igTl += (itmInner.iamt) ? parseFloat((itmInner.iamt).toFixed(2)) : 0;
            total.csTl += (itmInner.csamt) ? parseFloat((itmInner.csamt).toFixed(2)) : 0;
        }
    } else {

        total.cgTl += (itmInner.camt) ? parseFloat((itmInner.camt).toFixed(2)) : 0;
        total.sgTl += (itmInner.samt) ? parseFloat((itmInner.samt).toFixed(2)) : 0;
        total.igTl += (itmInner.iamt) ? parseFloat((itmInner.iamt).toFixed(2)) : 0;
        total.csTl += (itmInner.csamt) ? parseFloat((itmInner.csamt).toFixed(2)) : 0;
    }

    total.cgTl = parseFloat((total.cgTl).toFixed(2));
    total.sgTl = parseFloat((total.sgTl).toFixed(2));
    total.igTl = parseFloat((total.igTl).toFixed(2));
    total.csTl = parseFloat((total.csTl).toFixed(2));

    return total;
}

function generateItcTotal(total, itcInner, flag) {
    if (flag == "A" || flag == "M" || !flag) {
        total.itc_cgTl += (itcInner.tx_c) ? parseFloat(parseFloat(itcInner.tx_c).toFixed(2)) : 0;
        total.itc_sgTl += (itcInner.tx_s) ? parseFloat(parseFloat(itcInner.tx_s).toFixed(2)) : 0;
        total.itc_igTl += (itcInner.tx_i) ? parseFloat(parseFloat(itcInner.tx_i).toFixed(2)) : 0;
        total.itc_csTl += (itcInner.tx_cs) ? parseFloat(parseFloat(itcInner.tx_cs).toFixed(2)) : 0;
    }
    return total;
}

function reformSummary(iResp, prevContent, formName, callback) {

    if (formName == "GSTR1" || formName == "GSTR1A" || formName == "GSTR1IFF") {
        iResp = iResp['GSTR1'];
    }
    else if (formName == "GSTR2A") {
        iResp = iResp['GSTR2A'];
    } else {
        iResp = iResp['GSTR2'];
    }

    var retArry = [];
    for (var a = 0, alen = iResp.length; a < alen; a++) {

        var section = iResp[a];
        if (section.cd == 'hsn' && formName == 'GSTR2')
            section.cd = 'hsnsum'
        var count = 0,
            ctinInv = prevContent[section.cd],
            result = {},
            total = null;

        if (section.cd == 'atadj' && ctinInv === undefined && typeof prevContent['txpd'] !== 'undefined') {
            ctinInv = prevContent['txpd']
        }

        if (section.cd == 'atadja' && ctinInv === undefined && typeof prevContent['txpda'] !== 'undefined') {
            ctinInv = prevContent['txpda']
        }

        if (section.cd == 'cdnr' && ctinInv === undefined && typeof prevContent['cdn'] !== 'undefined') {
            ctinInv = prevContent['cdn']
        }

        if (section.cd == 'cdnra' && ctinInv === undefined && typeof prevContent['cdna'] !== 'undefined') {
            ctinInv = prevContent['cdna']
        }



        if (formName == "GSTR1" || formName == "GSTR1A") {
            total = {
                "cgTl": 0,
                "sgTl": 0,
                "igTl": 0,
                "csTl": 0
            };
        } else {
            total = {
                "cgTl": 0,
                "sgTl": 0,
                "igTl": 0,
                "csTl": 0,
                "itc_cgTl": 0,
                "itc_sgTl": 0,
                "itc_igTl": 0,
                "itc_csTl": 0
            };
        }

        if (formName == "GSTR1" || formName == "GSTR2A" || formName == "GSTR1A") {
            switch (section.cd) {
                case "b2b":
                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.inv, function (inv, i) {
                            count += 1;
                            angular.forEachCustom(inv.itms, function (itm, i) {
                                var itmInner = itm.itm_det;
                                result = generateTotal(total, itmInner, 'b2b', invInner, inv.inv_typ);
                            });
                        });
                    });
                    break;
                case "b2ba":
                case "b2cl":
                case "b2cla":
                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.inv, function (inv, i) {
                            count += 1;
                            angular.forEachCustom(inv.itms, function (itm, i) {
                                var itmInner = itm.itm_det;
                                result = generateTotal(total, itmInner, section.cd, invInner, inv.inv_typ);
                            });
                        });
                    });
                    break;
                case "exp":
                case "expa":
                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.inv, function (inv, i) {
                            count += 1;
                            angular.forEachCustom(inv.itms, function (itmInner, i) {
                                result = generateTotal(total, itmInner, section.cd, invInner, invInner.exp_typ);
                            });
                        });
                    });
                    break;
                case "at":
                case "ata":
                case "txpd":
                case "txpda":
                case "atadj":
                case "atadja":
                    angular.forEachCustom(ctinInv, function (inv, i) {
                        count += 1;
                        angular.forEachCustom(inv.itms, function (itmInner, i) {
                            result = generateTotal(total, itmInner);
                        });
                    });
                    break;

                case "b2cs":
                    angular.forEachCustom(ctinInv, function (itmInner, i) {
                        result = generateTotal(total, itmInner);
                        count += 1;
                    });
                    break;
                //Added by Janhavi,defect fix- view summary table
                case "b2csa":
                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.itms, function (itmInner, i) {
                            result = generateTotal(total, itmInner);
                            count += 1;
                        });
                    });
                    break;
                case "cdnr":
                case "cdnra":

                    angular.forEachCustom(ctinInv, function (invInner, i) {

                        angular.forEachCustom(invInner.nt, function (nt, i) {
                            count += 1;

                            angular.forEachCustom(nt.itms, function (itm, i) {

                                var itmInner = itm.itm_det;
                                var InnerInv = nt.ntty;

                                result = generateTotal(total, itmInner, section.cd, InnerInv, nt.inv_typ);
                            });
                        });
                    });
                    break;
                case "cdnur":
                case "cdnura":
                    angular.forEachCustom(ctinInv, function (inv, i) {
                        count += 1;
                        angular.forEachCustom(inv.itms, function (itms, i) {
                            var InnerInv = inv.ntty;
                            var itmInner = itms.itm_det;
                            result = generateTotal(total, itmInner, section.cd, InnerInv, inv.typ);
                        });
                    });
                    break;
                case "hsn":
                    if (ctinInv) {
                        angular.forEachCustom(ctinInv.data, function (itmInner, i) {
                            result = generateTotal(total, itmInner, section.cd);
                            count += 1;
                        });
                    }
                    break;


                case "isd":
                case "isda":

                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.doclist, function (inv, i) {
                            count += 1;
                            result = generateTotal(total, inv, section.cd);

                        });
                    });
                    break;

                case "tds":
                case "tdsa":
                    angular.forEachCustom(ctinInv, function (inv, i) {
                        count += 1;
                        result = generateTotal(total, inv, section.cd);
                    });
                    break;
                case "impg":
                    angular.forEachCustom(ctinInv, function (inv, i) {
                        count += 1;
                        result = generateTotal(total, inv, section.cd);
                    });
                    break;
                case "impgsez":
                    angular.forEachCustom(ctinInv, function (inv, i) {
                        count += 1;
                        result = generateTotal(total, inv, section.cd);
                    });
                    break;

                case "nil_supplies":

                    break;
            }
        } else {
            switch (section.cd) {
                case "b2b":
                case "b2ba":
                case "b2bur":
                case "b2bura":
                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.inv, function (inv, i) {
                            count += 1;
                            angular.forEachCustom(inv.itms, function (itm, i) {
                                var itmInner = itm.itm_det,
                                    itcInner = itm.itc,
                                    flag = inv.flag;
                                result = generateTotal(total, itmInner);
                                result = generateItcTotal(total, itcInner, flag);
                            });
                        });
                    });
                    break;

                case "cdnr":
                case "cdnra":

                    angular.forEachCustom(ctinInv, function (invInner, i) {
                        angular.forEachCustom(invInner.nt, function (inv, i) {
                            count += 1;
                            angular.forEachCustom(inv.itms, function (itm, i) {
                                var InnerInv = inv.ntty;
                                var itmInner = itm.itm_det,
                                    itcInner = itm.itc,
                                    flag = inv.flag;
                                result = generateTotal(total, itmInner, section.cd, InnerInv, inv.typ);
                                result = generateItcTotal(total, itcInner, flag);
                            });
                        });
                    });
                    break;
                case "cdnur":
                    angular.forEachCustom(ctinInv, function (inv, i) {
                        count += 1;
                        angular.forEachCustom(inv.itms, function (itms, i) {
                            var InnerInv = inv.ntty;
                            var itmInner = itms.itm_det;
                            var itcInner = itms.itc;
                            var flag = inv.flag;
                            result = generateTotal(total, itmInner, section.cd, InnerInv, inv.typ);
                            result = generateItcTotal(total, itcInner, flag);
                        });
                    });
                    break;
                case "txi":
                case "atadj":
                case "txpd":
                case "atxi":
                case "imp_g":
                case "imp_ga":
                case "imp_s":
                case "imp_sa":
                    angular.forEachCustom(ctinInv, function (inv, i) {

                        count += 1;
                        angular.forEachCustom(inv.itms, function (itmInner, i) {
                            var flag = inv.flag;
                            result = generateTotal(total, itmInner);
                            result = generateItcTotal(total, itmInner, flag);

                        });
                    });
                    break;

                case "hsnsum":
                case "hsn":
                    if (ctinInv)
                        angular.forEachCustom(ctinInv.det, function (itmInner, i) {
                            if (!itmInner)
                                return;

                            result = generateTotal(total, itmInner, section.cd);
                            count += 1;
                        });
                    break;
                case "itc_rvsl":

                    angular.forEachCustom(ctinInv, function (itmInner, i) {

                        result = generateTotal(total, itmInner, section.cd);
                        count += 1;

                    });
                    if (ctinInv) {
                        if ('chksum' in ctinInv) {
                            count -= 1;
                        }
                    }


                    break;

            }

        }

        if (count) {
            retArry.push({
                cd: section.cd,
                result: result,
                count: count,
                name: section.nm
            });
        }
    }

    callback(retArry);
}

var update_meta_file = function (filename, json, form, cb) {
    var meta_filename = filename.replace(".json", "_meta.json");
    var config_keys = Object.keys(json);
    var metaJSON = {};
    var formName = form;
    var response = fs.readFileSync(__dirname + '/../public/data/tablename.json', "utf8");
    response = JSON.parse(response);


    var metaJSON = {};
    for (var i = 0; i < config_keys.length; i++) {
        if (typeof json[config_keys[i]] != 'object') {
            metaJSON[config_keys[i]] = json[config_keys[i]];
        }
    }

    reformSummary(response, json, formName, function (iData) {
        metaJSON['counts'] = iData;
        if (!cb)
            fs.writeFileSync(meta_filename, JSON.stringify(metaJSON));
        else {
            fs.writeFile(meta_filename, JSON.stringify(metaJSON), (err) => {
                if (err) throw err;
                cb(err)
            });
        }
    });



}
// ADDITION BY V END


var addtbldata = function (req, res) {
    var errorObject = null;
    logger.log("info", "Entering Offline js:: addtbldata ");
    try {
        var gstin = req.body.gstin;
        var form = req.body.form;
        var gt = req.body.gt;
        var cur_gt = req.body.cur_gt;
        var fp = req.body.fp;
        var fy = req.body.fy;
        var month = req.body.month;
        var tblcd = req.body.tbl_cd;
        var tbl_data = req.body.tbl_data;
        var jsonObj = [];
        var crclm_17_3 = req.body.crclm_17_3;
        var type = req.body.type;
        var dir, isSameGSTIN, filename;
        var impfileName = req.body.returnFileName;
        async.waterfall([
            function (callback) {
                logger.log("info", "entered in async.waterfall function 1");
                common.formDataFormat(req, function (formDataFormat) {
                    logger.log("info", "entered in async.waterfall formDataFormat");
                    callback(null, formDataFormat)
                })
            },
            function (formDataFormat, callback) {
                logger.log("info", "entered in async.waterfall function 2");
                if (type == "Import") {
                    dir = uploadedImpFiledir;
                    filename = dir + "/" + impfileName.replace("./download", "");
                } else {
                    dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month;
                    filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json';
                }


                // directory does not exists.
                // lets create this
                if (!fs.existsSync(dir)) {
                    mkdirp.sync(dir);
                }


                // directory still does not exists.
                // nothing else can be done. lets skip
                if (!fs.existsSync(dir)) {
                    logger.log("error", "error while creating the directory :: %s ", err.message);
                    callback("error while creating the directory :: %s ", null)
                }

                // check if file exists or not
                // lets create if it doesnt exist.
                // if doesnt exist, lets skip, nothing else can be done.
                if (!fs.existsSync(filename)) {
                    try {
                        fs.writeFileSync(filename, formDataFormat);
                    }
                    catch (err) {

                        logger.log("error", "error in creating a file:: %s", err.message);
                        callback(err, null);
                    }

                }
                var err;
                var data = fs.readFileSync(filename, 'utf8');


                logger.log("info", "file is there.We will append data into it");
                var gstfile = JSON.parse(data);

                if (type == "Import" && form === "GSTR2") {
                    var b2bur = [];
                    var b2bura = [];
                    var imp_g = [];
                    var imp_ga = [];
                    var nil_supplies = [];
                    var imp_s = [];
                    var imp_sa = [];
                    var hsnsum = [];
                    var txi = [];
                    var atxi = [];
                    var atadj = [];
                    var inv = {
                        "inv": []
                    };
                    b2bur[0] = inv;
                    b2bura[0] = inv;
                    gstfile.b2bur = b2bur;
                    gstfile.b2bura = b2bura;
                    gstfile.imp_g = imp_g;
                    gstfile.imp_ga = imp_ga;
                    gstfile.nil_supplies = nil_supplies;
                    gstfile.imp_s = imp_s;
                    gstfile.imp_sa = imp_sa;
                    gstfile.hsnsum = hsnsum;
                    gstfile.txi = txi;
                    gstfile.atxi = atxi;
                    gstfile.atadj = atadj;
                    fs.writeFileSync(filename, JSON.stringify(gstfile));
                }

                var tbldata;
                var jsonObj = [];
                if (form == "GSTR1" && tblcd == "hsnsum") { tblcd = "hsn"; }
                switch (tblcd) {

                    case "b2b":
                    case "b2ba":
                        logger.log("info", "entered in b2b & b2ba section");

                        if (tblcd == "b2b") {
                            if (!gstfile.b2b) {
                                gstfile.b2b = [];
                            }
                            tbldata = gstfile.b2b;
                        } else {
                            if (!gstfile.b2ba) {
                                gstfile.b2ba = [];
                            }
                            tbldata = gstfile.b2ba;
                        }
                        var responseinvce = [];
                        var keyObj = {};

                        for (var i = 0; i < tbl_data.length; i++) {

                            if (gstin == tbl_data[i].ctin || gstin == tbl_data[i].inv[0].etin) {
                                isSameGSTIN = gstin;
                            } else {

                                keyObj.ctin = tbl_data[i].ctin;
                                keyObj.inum = tbl_data[i].inv[0].inum;
                                responseinvce.push(keyObj);
                                var arrayFound = tbldata.myFind({
                                    'ctin': responseinvce[0].ctin
                                });
                                var status = tbl_data[i].inv[0].status;
                                if (status) {
                                    tbl_data[i].inv[0].status = undefined;
                                }

                                if ((status && status != 'Cancelled') || !status) {
                                    if (arrayFound.length != 0) {

                                        var subarray = {};
                                        subarray = arrayFound[0].inv;
                                        var subArrayFound = subarray.myFind({
                                            'inum': responseinvce[0].inum
                                        });
                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                        if (subArrayFound.length == 0) {

                                            subarray.push(tbl_data[i].inv[0]);
                                            common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);
                                        } else {

                                            subarray.splice(subIndex, 1);
                                            subarray.splice(subIndex, 0, tbl_data[i].inv[0])

                                            jsonObj.push(responseinvce[0].inum);
                                        }

                                    } else {
                                        tbldata.push(tbl_data[i]);
                                    }
                                }

                            }
                        }



                        break;
                    case "doc_issue":

                        var uniKeyAry = [];  // array to store unique key property
                        var keyObj = {};
                        if (!gstfile.doc_issue)
                            gstfile.doc_issue = { "doc_det": [] };
                        tbldata = gstfile.doc_issue;
                        if (tbldata['flag']) {
                            delete tbldata['flag'];
                        }
                        var tblarray = tbldata.doc_det;

                        for (var i = 0; i < tbl_data.length; i++) {

                            keyObj.doc_num = tbl_data[i].doc_num;


                            uniKeyAry.push(keyObj);


                            var arrayFound = tblarray.myFind({
                                'doc_num': uniKeyAry[0].doc_num
                            });

                            if (arrayFound.length != 0) { // if doc_num already exists
                                var docAry = {};
                                docAry = arrayFound[0].docs;
                                for (var inputRow = 0; inputRow < tbl_data[0].docs.length; inputRow++) {
                                    var subArrayFound = docAry.myFind({
                                        'num': tbl_data[0].docs[inputRow].num
                                    });

                                    if (subArrayFound.length != 0) {

                                        var subIndex = docAry.indexOf(subArrayFound[0]);
                                        docAry.splice(subIndex, 1);
                                        docAry.splice(subIndex, 0, tbl_data[0].docs[inputRow])

                                    }
                                    else {
                                        docAry.push(tbl_data[0].docs[inputRow]);
                                    }

                                }

                            }
                            else //if doc_num does not exist
                            {

                                tblarray.push(tbl_data[i]);
                            }



                        }

                        break;
                    case "b2cl":
                    case "b2cla":
                        logger.log("info", "entered in b2cl & b2cla section");

                        if (tblcd == "b2cl") {
                            if (!gstfile.b2cl) {
                                gstfile.b2cl = [];
                            }
                            tbldata = gstfile.b2cl;
                        } else {
                            if (!gstfile.b2cla) {
                                gstfile.b2cla = [];
                            }
                            tbldata = gstfile.b2cla;
                        }
                        var responseinvce = [];
                        var keyObj = {};

                        for (var i = 0; i < tbl_data.length; i++) {

                            if (gstin == tbl_data[i].inv[0].etin) {
                                isSameGSTIN = gstin;
                            } else {
                                keyObj.pos = tbl_data[i].pos;


                                keyObj.inum = tbl_data[i].inv[0].inum;



                                responseinvce.push(keyObj);




                                var arrayFound = tbldata.myFind({
                                    'pos': responseinvce[0].pos
                                });

                                if (arrayFound.length != 0) {

                                    var subarray = {};
                                    subarray = arrayFound[0].inv;
                                    var subArrayFound = subarray.myFind({
                                        'inum': responseinvce[0].inum
                                    });
                                    var subIndex = subarray.indexOf(subArrayFound[0]);


                                    if (subArrayFound.length == 0) {

                                        subarray.push(tbl_data[i].inv[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    } else {

                                        subarray.splice(subIndex, 1);
                                        subarray.splice(subIndex, 0, tbl_data[i].inv[0])

                                        jsonObj.push(responseinvce[0].inum);
                                    }

                                } else {
                                    tbldata.push(tbl_data[i]);
                                }
                            }

                        }
                        break;
                    case "b2cs":
                        logger.log("info", "entered in b2cs & b2csa section addtbldata");
                        if (tblcd == "b2cs") {
                            if (!gstfile.b2cs) {
                                gstfile.b2cs = []
                            }
                            tbldata = gstfile.b2cs;
                        } else {
                            tbldata = gstfile.b2csa;
                        }



                        for (var i = 0; i < tbl_data.length; i++) {
                            var count = 0;
                            if (gstin == tbl_data[i].etin) {
                                isSameGSTIN = gstin;
                            } else {
                                for (var j = 0; j < tbldata.length; j++) {

                                    if (tbldata[j].pos === tbl_data[i].pos) {
                                        if (tbldata[j].rt === tbl_data[i].rt) {
                                            if (tbldata[j].etin === tbl_data[i].etin) {
                                                if (tbldata[j].diff_percent === tbl_data[i].diff_percent) {
                                                    tbldata.splice(j, 1);
                                                    tbldata.splice(j, 0, tbl_data[i]);
                                                    count = 1;
                                                }
                                            }

                                        }
                                    }
                                }
                                if (count != 1) {

                                    tbldata.push(tbl_data[i]);

                                } else {
                                    jsonObj.push(tblcd + ":" + tbl_data[i].pos + "_" + tbl_data[i].rt + "_" + tbl_data[i].typ);
                                }
                            }

                        }
                        break;
                    case "b2csa":
                        logger.log("info", "entered in b2cs & b2csa section addtbldata");

                        if (!gstfile.b2csa) {
                            gstfile.b2csa = []
                        }
                        tbldata = gstfile.b2csa;




                        for (var i = 0; i < tbl_data.length; i++) {
                            var count = 0;
                            if (gstin == tbl_data[i].etin) {
                                isSameGSTIN = gstin;
                            } else {
                                for (var j = 0; j < tbldata.length; j++) {

                                    if (tbldata[j].pos === tbl_data[i].pos) {
                                        if (tbldata[j].omon === tbl_data[i].omon) {
                                            if (tbldata[j].etin === tbl_data[i].etin) {
                                                if (tbldata[j].diff_percent === tbl_data[i].diff_percent) {
                                                    tbldata.splice(j, 1);
                                                    tbldata.splice(j, 0, tbl_data[i]);
                                                    count = 1;
                                                }
                                            }

                                        }
                                    }
                                }
                                if (count != 1) {

                                    tbldata.push(tbl_data[i]);

                                } else {
                                    jsonObj.push(tblcd + ":" + tbl_data[i].omon + "_" + tbl_data[i].pos + "_" + tbl_data[i].typ);
                                }
                            }

                        }
                        break;
                    case "cdnr":
                    case "cdnra":
                        logger.log("info", "entered in cdnr & cdnra section");

                        if (type == "Import" && tblcd == "cdnr" && !gstfile.cdnr) {
                            if (!gstfile.cdn) {
                                gstfile.cdn = [];

                            }
                            tbldata = gstfile.cdn;
                        } else {
                            if (tblcd == "cdnr") {
                                if (!gstfile.cdnr) {
                                    gstfile.cdnr = [];
                                }
                                tbldata = gstfile.cdnr
                            } else if (tblcd == "cdn") {
                                if (!gstfile.cdn) {
                                    gstfile.cdn = [];
                                }
                                tbldata = gstfile.cdnr
                            } else {
                                if (!gstfile.cdnra) {
                                    gstfile.cdnra = [];
                                }
                                tbldata = gstfile.cdnra;
                            }
                        }
                        var responseinvce = [];
                        var keyObj = {};


                        for (var i = 0; i < tbl_data.length; i++) {
                            var duplicate_found = false;
                            if (gstin == tbl_data[i].ctin) {
                                isSameGSTIN = gstin;
                            } else {
                                keyObj.ctin = tbl_data[i].ctin;
                                keyObj.nt_num = tbl_data[i].nt[0].nt_num;
                                responseinvce.push(keyObj);
                                var arrayFound = tbldata.myFind({
                                    'ctin': responseinvce[0].ctin
                                });
                                var status = tbl_data[i].nt[0].status;
                                if (status) {
                                    tbl_data[i].nt[0].status = undefined;
                                }

                                if ((status && status != 'Cancelled') || !status) {
                                    if (arrayFound.length != 0) {

                                        var subarray = {};
                                        subarray = arrayFound[0].nt;
                                        var subArrayFound = subarray.myFind({
                                            'nt_num': responseinvce[0].nt_num
                                        });
                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                        if (subArrayFound.length == 0) {
                                            subarray.push(tbl_data[i].nt[0]);
                                            common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);
                                        } else {

                                            subarray.splice(subIndex, 1);
                                            subarray.splice(subIndex, 0, tbl_data[i].nt[0])

                                            jsonObj.push(responseinvce[0].nt_num);
                                        }

                                    } else {
                                        tbldata.push(tbl_data[i]);
                                    }
                                }
                            }
                        }

                        break;
                    case "cdnur":
                    case "cdnura":
                        logger.log("info", "entered in cdnur section");
                        if (tblcd == "cdnur" && !gstfile.cdnur) {
                            gstfile.cdnur = [];
                        }
                        if (tblcd == "cdnura" && !gstfile.cdnura) {
                            gstfile.cdnura = [];
                        }

                        logger.log("info", "entered in cdnur section");

                        if (tblcd == "cdnur") {
                            tbldata = gstfile.cdnur;
                        } else {
                            tbldata = gstfile.cdnura;
                        }
                        var responseinvce = [];
                        var keyObj = {};

                        for (var i = 0; i < tbl_data.length; i++) {



                            keyObj.nt_num = tbl_data[i].nt_num;



                            responseinvce.push(keyObj);




                            var arrayFound = tbldata.myFind({
                                'nt_num': responseinvce[0].nt_num
                            });
                            var status = tbl_data[i].status;
                            if (status) {
                                tbl_data[i].status = undefined;
                            }

                            if ((status && status != 'Cancelled') || !status) {
                                if (arrayFound.length != 0) {


                                    var Index = tbldata.indexOf(arrayFound[0]);


                                    tbldata.splice(Index, 1);
                                    tbldata.splice(Index, 0, tbl_data[i])

                                    jsonObj.push(responseinvce[0].nt_num);
                                } else {
                                    tbldata.push(tbl_data[i]);
                                }
                            }
                        }

                        break;
                    case "nil":
                        logger.log("info", "entered in nil section");
                        if (form == "GSTR2") {
                            tbldata = gstfile.nil_supplies;
                            tbldata = tbl_data[0];
                            gstfile.nil_supplies = tbldata;
                        } else {

                            if (!gstfile.nil)
                                gstfile.nil = {};
                            tbldata = gstfile.nil;
                            tbldata.inv = []; // empty the array to update
                            for (var p = 0; p < tbl_data.length; p++) {

                                tbldata.inv.push(tbl_data[p]);
                            }
                            if (tbldata.flag)
                                tbldata.flag = "E";

                        }
                        break;
                    case "exp":
                    case "expa":
                        logger.log("info", "entered in exp & expa section");
                        if (tblcd == "exp") {
                            if (!gstfile.exp) {
                                gstfile.exp = [];
                            }
                            tbldata = gstfile.exp;
                        } else {
                            if (!gstfile.expa) {
                                gstfile.expa = [];
                            }
                            tbldata = gstfile.expa;
                        }
                        var responseinvce = [];
                        var keyObj = {};

                        for (var i = 0; i < tbl_data.length; i++) {
                            keyObj.exp_typ = tbl_data[i].exp_typ;


                            keyObj.inum = tbl_data[i].inv[0].inum;



                            responseinvce.push(keyObj);




                            var arrayFound = tbldata.myFind({
                                'exp_typ': responseinvce[0].exp_typ
                            });
                            var status = tbl_data[i].inv[0].status;
                            if (status) {
                                tbl_data[i].inv[0].status = undefined;
                            }

                            if ((status && status != 'Cancelled') || !status) {
                                if (arrayFound.length != 0) {

                                    var subarray = {};
                                    subarray = arrayFound[0].inv;
                                    var subArrayFound = subarray.myFind({
                                        'inum': responseinvce[0].inum
                                    });
                                    var subIndex = subarray.indexOf(subArrayFound[0]);


                                    if (subArrayFound.length == 0) {
                                        subarray.push(tbl_data[i].inv[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].exp_typ, subarray, tblcd);
                                    } else {

                                        subarray.splice(subIndex, 1);
                                        subarray.splice(subIndex, 0, tbl_data[i].inv[0])

                                        jsonObj.push(responseinvce[0].inum);
                                    }

                                } else {
                                    tbldata.push(tbl_data[i]);
                                }
                            }
                        }

                        break;
                    case "at":
                        logger.log("info", "entered in at & ata section");

                        if (!gstfile.at) {
                            gstfile.at = []
                        }
                        tbldata = gstfile.at;

                        var isExisting = true;
                        var keyObj = {};

                        if (form == 'GSTR1')
                            for (var j = 0; j < tbldata.length; j++) {
                                if (!tbldata[j].diff_percent)
                                    tbldata[j].diff_percent = null;
                            }

                        for (var i = 0; i < tbl_data.length; i++) {
                            if (form == 'GSTR1') {
                                if (!tbl_data[i].diff_percent)
                                    tbl_data[i].diff_percent = null;
                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos,
                                    'diff_percent': tbl_data[i].diff_percent
                                });
                            } else {
                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos

                                });
                            }

                            var newIndex = tbldata.indexOf(arrayFound[0]);
                            if (arrayFound.length == 0) {
                                isExisting = false;
                                tbldata.push(tbl_data[i]);
                            } else {
                                if (isExisting == false) {
                                    var subarray = {};
                                    subarray = arrayFound[0].itms;
                                    subarray.push(tbl_data[i].itms[0]);
                                    common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                } else {


                                    if (keyObj.index == null || keyObj.index != newIndex) {
                                        tbldata[newIndex] = tbl_data[i];

                                        keyObj.index = newIndex;
                                    } else {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    }

                                    jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                }

                            }


                        }
                        break;
                    case "ata":
                        logger.log("info", "entered ata section");

                        if (!gstfile.ata) {
                            gstfile.ata = []
                        }

                        tbldata = gstfile.ata;


                        var isExisting = true;
                        var keyObj = {};

                        if (form == 'GSTR1')
                            for (var j = 0; j < tbldata.length; j++) {
                                if (!tbldata[j].diff_percent)
                                    tbldata[j].diff_percent = null;
                            }

                        for (var i = 0; i < tbl_data.length; i++) {
                            if (form == 'GSTR1') {
                                if (!tbl_data[i].diff_percent)
                                    tbl_data[i].diff_percent = null;
                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos,
                                    'omon': tbl_data[i].omon,
                                    'diff_percent': tbl_data[i].diff_percent
                                });
                            } else {
                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos,
                                    'omon': tbl_data[i].omon

                                });
                            }
                            var newIndex = tbldata.indexOf(arrayFound[0]);
                            if (arrayFound.length == 0) {
                                isExisting = false;
                                tbldata.push(tbl_data[i]);
                            } else {
                                if (isExisting == false) {
                                    var subarray = {};
                                    subarray = arrayFound[0].itms;
                                    subarray.push(tbl_data[i].itms[0]);
                                    common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                } else {


                                    if (keyObj.index == null || keyObj.index != newIndex) {
                                        tbldata[newIndex] = tbl_data[i];

                                        keyObj.index = newIndex;
                                    } else {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    }

                                    jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                }

                            }


                        }
                        break;
                    case "atadj":
                        logger.log("info", "entered in atadj section");
                        if (type == "Import") {
                            if (!gstfile.txpd) {
                                gstfile.txpd = [];
                            }

                            tbldata = gstfile.txpd;
                        } else {
                            if (!gstfile.atadj) {
                                gstfile.atadj = [];
                            }

                            tbldata = gstfile.atadj;

                        }
                        if (form == "GSTR1") {

                            var isExisting = true;
                            var keyObj = {};
                            for (var j = 0; j < tbldata.length; j++) {
                                if (!tbldata[j].diff_percent)
                                    tbldata[j].diff_percent = null;
                            }
                            for (var i = 0; i < tbl_data.length; i++) {

                                if (!tbl_data[i].diff_percent)
                                    tbl_data[i].diff_percent = null;
                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos,
                                    'diff_percent': tbl_data[i].diff_percent
                                });
                                var newIndex = tbldata.indexOf(arrayFound[0]);
                                if (arrayFound.length == 0) {
                                    isExisting = false;
                                    tbldata.push(tbl_data[i]);
                                } else {
                                    if (isExisting == false) {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    } else {


                                        if (keyObj.index == null || keyObj.index != newIndex) {
                                            tbldata[newIndex] = tbl_data[i];

                                            keyObj.index = newIndex;
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].itms;
                                            subarray.push(tbl_data[i].itms[0]);
                                            common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                        }

                                        jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                    }

                                }


                            }
                        } else { //for  GSTR2

                            var isExisting = true;
                            var keyObj = {};
                            for (var i = 0; i < tbl_data.length; i++) {


                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos
                                });
                                var newIndex = tbldata.indexOf(arrayFound[0]);
                                if (arrayFound.length == 0) {
                                    isExisting = false;
                                    tbldata.push(tbl_data[i]);
                                } else {
                                    if (isExisting == false) {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    } else {


                                        if (keyObj.index == null || keyObj.index != newIndex) {
                                            tbldata[newIndex] = tbl_data[i];

                                            keyObj.index = newIndex;
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].itms;
                                            subarray.push(tbl_data[i].itms[0]);
                                            common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                        }

                                        jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                    }

                                }


                            }



                        }
                        break;
                    case "atadja":
                        logger.log("info", "entered in atadja section");
                        if (type == "Import") {
                            if (!gstfile.txpda) {
                                gstfile.txpda = [];
                            }

                            tbldata = gstfile.txpda;
                        } else {
                            if (!gstfile.atadja) {
                                gstfile.atadja = [];
                            }

                            tbldata = gstfile.atadja;

                        }

                        if (form == "GSTR1") {

                            var isExisting = true;
                            var keyObj = {};
                            for (var j = 0; j < tbldata.length; j++) {
                                if (!tbldata[j].diff_percent)
                                    tbldata[j].diff_percent = null;
                            }
                            for (var i = 0; i < tbl_data.length; i++) {

                                if (!tbl_data[i].diff_percent)
                                    tbl_data[i].diff_percent = null;
                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos,
                                    'omon': tbl_data[i].omon,
                                    'diff_percent': tbl_data[i].diff_percent
                                });
                                var newIndex = tbldata.indexOf(arrayFound[0]);
                                if (arrayFound.length == 0) {
                                    isExisting = false;
                                    tbldata.push(tbl_data[i]);
                                } else {
                                    if (isExisting == false) {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    } else {


                                        if (keyObj.index == null || keyObj.index != newIndex) {
                                            tbldata[newIndex] = tbl_data[i];

                                            keyObj.index = newIndex;
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].itms;
                                            subarray.push(tbl_data[i].itms[0]);
                                            common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                        }

                                        jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                    }

                                }


                            }
                        } else { //for  GSTR2

                            var isExisting = true;
                            var keyObj = {};
                            for (var i = 0; i < tbl_data.length; i++) {


                                var arrayFound = tbldata.myFind({
                                    'pos': tbl_data[i].pos,
                                    'omon': tbl_data[i].omon
                                });
                                var newIndex = tbldata.indexOf(arrayFound[0]);
                                if (arrayFound.length == 0) {
                                    isExisting = false;
                                    tbldata.push(tbl_data[i]);
                                } else {
                                    if (isExisting == false) {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    } else {


                                        if (keyObj.index == null || keyObj.index != newIndex) {
                                            tbldata[newIndex] = tbl_data[i];

                                            keyObj.index = newIndex;
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].itms;
                                            subarray.push(tbl_data[i].itms[0]);
                                            common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                        }

                                        jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                    }

                                }


                            }



                        }
                        break;

                    case "hsn":
                        logger.log("info", "entered in hsn section addtabldata");
                        tbldata = gstfile.hsn ? gstfile.hsn : gstfile.hsnsum;
                        // if (tbldata['flag']) {
                        //     delete tbldata['flag'];
                        // }
                        if (typeof tbldata.data == 'object') {
                            var total_hsn_objects = gstfile.hsn.data.length;
                        } else {
                            var total_hsn_objects = 0;
                        }
                        total_hsn_objects++; // num  should atleast be 1

                        for (var i = 0; i < tbl_data.length; i++) {

                            var count = 0;

                            for (var j = 0; j < tbldata.data.length; j++) {
                                var isReturnPeriodBeforeNewHSN = isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, fp);
                                if (isReturnPeriodBeforeNewHSN) {
                                    if (tbldata.data[j].hsn_sc === tbl_data[i].data[0].hsn_sc) {

                                        if (!tbldata.data[j].desc)
                                            tbldata.data[j].desc = '';
                                        if (!tbl_data[i].data[0].desc)
                                            tbl_data[i].data[0].desc = '';

                                        if ((tbldata.data[j].desc).toLowerCase() === (tbl_data[i].data[0].desc).toLowerCase()) {

                                            if ((tbldata.data[j].uqc).toLowerCase() === (tbl_data[i].data[0].uqc).toLowerCase()) {
                                                if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, fp)) {
                                                    if (tbldata.data[j].rt == tbl_data.dt[i].data[0].rt) {

                                                        tbl_data[i].data[0].num = tbldata.data[j].num;
                                                        //todo

                                                        tbldata.data.splice(j, 1);
                                                        tbldata.data.splice(j, 0, tbl_data[i].data[0]);
                                                        count = 1;
                                                    }
                                                }
                                                else {
                                                    tbl_data[i].data[0].num = tbldata.data[j].num;


                                                    tbldata.data.splice(j, 1);
                                                    tbldata.data.splice(j, 0, tbl_data[i].data[0]);
                                                    count = 1;
                                                }
                                            }

                                        }

                                    }
                                }
                                else {
                                    if (tbldata.data[j].hsn_sc === tbl_data[i].data[0].hsn_sc) {

                                        if (!tbldata.data[j].desc)
                                            tbldata.data[j].desc = '';
                                        if (!tbl_data[i].data[0].desc)
                                            tbl_data[i].data[0].desc = '';



                                        if (tbldata.data[j].rt === tbl_data[i].data[0].rt) {

                                            if ((tbldata.data[j].uqc).toLowerCase() === (tbl_data[i].data[0].uqc).toLowerCase()) {
                                                tbl_data[i].data[0].num = tbldata.data[j].num;
                                                //todo

                                                tbldata.data.splice(j, 1);
                                                tbldata.data.splice(j, 0, tbl_data[i].data[0]);
                                                count = 1;
                                            }

                                        }

                                    }
                                }
                            }
                            if (count != 1) {
                                var maxNum = 0;
                                forEach(tbldata.data, function (data, index) {
                                    if (data.num >= maxNum) {
                                        maxNum = data.num + 1;
                                    }
                                });

                                tbl_data[i].data[0].num = ((total_hsn_objects >= maxNum) ? total_hsn_objects : maxNum);
                                total_hsn_objects++;


                                tbldata.data.push(tbl_data[i].data[0]);

                            } else {
                                if (!tbl_data[i].data[0].hsn_sc) {
                                    jsonObj.push(tblcd + ":" + tbl_data[i].data[0].desc);
                                } else {
                                    jsonObj.push(tblcd + ":" + tbl_data[i].data[0].hsn_sc);
                                }

                            }
                        }

                        break;
                    case "b2bur": //for  GSTR2
                    case "b2bura": //for GSTR2
                        logger.log("info", "entered in b2bur & b2bur section");
                        if (tblcd == "b2bur") {
                            if (!gstfile.b2bur) {
                                var newB2bur = [];
                                newB2bur.push({});
                                newB2bur[0].inv = [];
                                gstfile.b2bur = newB2bur
                            }
                            tbldata = gstfile.b2bur;
                        } else {
                            if (!gstfile.b2bur) {
                                var newB2bura = [];
                                newB2bura.push({});
                                newB2bura[0].inv = [];
                                gstfile.b2bura = newB2bur
                            }
                            tbldata = gstfile.b2bura;
                        }
                        var exstnginvce = []; //to find all the invoice no. exists
                        var responseinvce = [];

                        for (var i = 0; i < tbldata.length; i++) //loop to find all the existing invoice no.
                        {
                            for (var j = 0; j < tbldata[i].inv.length; j++) {
                                exstnginvce.push(tbldata[i].inv[j].inum);

                            }
                        }


                        for (var i = 0; i < tbl_data.length; i++) //loop to find all the previous invoice no.
                        {

                            for (var j = 0; j < tbl_data[i].inv.length; j++) {
                                responseinvce.push(tbl_data[i].inv[j].inum);

                            }

                        }


                        for (var i = 0; i < responseinvce.length; i++) //loop to check that invoice no. exist or not
                        {
                            var count = 0;


                            for (var j = 0; j < exstnginvce.length; j++) {

                                if (exstnginvce[j] == responseinvce[i]) {

                                    jsonObj.push(responseinvce[i]);

                                    count = count + 1;
                                }
                            }
                            if (count == 0) {
                                var arrayFound = tbldata[0].inv;

                                var subarrayFound = arrayFound.myFind({
                                    'inum': tbl_data[i].inv.inum
                                });
                                if (subarrayFound.length == 0) {

                                    tbldata[0].inv.push(tbl_data[i].inv[0]);

                                } else {

                                    var index = tbldata.indexOf(subarrayFound[0]);
                                    tbldata[0].inv.splice(index, 1); //delete row first with matched inv


                                    tbldata[0].inv.splice(index, 0, tbl_data[i].inv[0]); //insert updated row in the same index of previous row


                                }
                            }


                        }

                        break;
                    case "imp_g": //for  GSTR2
                    case "imp_ga": //for  GSTR2
                        logger.log("info", "entered in imp_g & imp_g section");
                        if (tblcd == "imp_g") {
                            if (!gstfile.imp_g) {
                                gstfile.imp_g = [];
                            }
                            tbldata = gstfile.imp_g;
                        } else {
                            if (!gstfile.imp_ga) {
                                gstfile.imp_ga = [];
                            }
                            tbldata = gstfile.imp_ga;
                        }

                        //chnages by prakash- start
                        for (var i = 0; i < tbl_data.length; i++) {
                            var count = 0;

                            for (var j = 0; j < tbldata.length; j++) {

                                if (tbldata[j].port_code === tbl_data[i].port_code) {
                                    if (tbldata[j].boe_num === tbl_data[i].boe_num) {


                                        tbldata.splice(j, 1);
                                        tbldata.splice(j, 0, tbl_data[i]);
                                        count = 1;



                                    }
                                }
                            }
                            if (count != 1) {

                                tbldata.push(tbl_data[i]);

                            } else {
                                jsonObj.push(tblcd + ":" + tbl_data[i].port_code + "_" + tbl_data[i].boe_num);
                            }


                        }
                        //changes by prakash-end
                        break;
                    case "imp_s": //for  GSTR2
                    case "imp_sa": //for  GSTR2
                        logger.log("info", "entered in imp_s & imp_sa section");
                        if (tblcd == "imp_s") {
                            if (!gstfile.imp_s) {
                                gstfile.imp_s = [];
                            }
                            tbldata = gstfile.imp_s;
                        } else {
                            if (!gstfile.imp_sa) {
                                gstfile.imp_sa = [];
                            }
                            tbldata = gstfile.imp_sa;
                        }
                        for (var i = 0; i < tbl_data.length; i++) {
                            var arrayFound = tbldata.myFind({
                                'inum': tbl_data[i].inum
                            });
                            if (arrayFound.length != 1) {
                                tbldata.push((tbl_data[i]));
                            } else {
                                jsonObj.push(tbl_data[i].inum);
                            }
                        }
                        break;
                    case "itc_rvsl": //for  GSTR2 31
                        logger.log("info", "entered in itc_rvsl section");
                        tbldata = gstfile.itc_rvsl;
                        if (typeof tbl_data.length !== 'undefined' && tbl_data.length > 0) {
                            tbl_data = tbl_data[0];
                        }
                        tbldata = tbl_data;

                        gstfile.itc_rvsl = tbldata;
                        break;
                    case "txi": //for  GSTR2
                    case "atxi": //for  GSTR2
                        logger.log("info", "entered in txi & atxi section");
                        if (tblcd == "txi") {
                            if (!gstfile.txi) {
                                gstfile.txi = []
                            }
                            tbldata = gstfile.txi;

                        } else {
                            tbldata = gstfile.atxi;

                        }


                        var isExisting = true;
                        var keyObj = {};

                        for (var i = 0; i < tbl_data.length; i++) {


                            var arrayFound = tbldata.myFind({
                                'pos': tbl_data[i].pos
                            });
                            var newIndex = tbldata.indexOf(arrayFound[0]);
                            if (arrayFound.length == 0) {
                                isExisting = false;
                                tbldata.push(tbl_data[i]);
                            } else {
                                if (isExisting == false) {
                                    var subarray = {};
                                    subarray = arrayFound[0].itms;
                                    subarray.push(tbl_data[i].itms[0]);
                                    common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                } else {


                                    if (keyObj.index == null || keyObj.index != newIndex) {
                                        tbldata[newIndex] = tbl_data[i];

                                        keyObj.index = newIndex;
                                    } else {
                                        var subarray = {};
                                        subarray = arrayFound[0].itms;
                                        subarray.push(tbl_data[i].itms[0]);
                                        common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                    }

                                    jsonObj.push(tblcd + ":" + tbl_data[i].pos);

                                }

                            }


                        }

                        break;
                    case "hsnsum": //for  GSTR2
                        logger.log("info", "entered in hsn section addtabldata");

                        if (!gstfile.hsnsum) {
                            var newhsnsum = {};
                            newhsnsum.det = [];
                            gstfile.hsnsum = newhsnsum
                        }
                        tbldata = gstfile.hsnsum;
                        if (typeof tbldata.det == 'object') {
                            var total_hsn_objects = tbldata.det.length;
                        } else {
                            var total_hsn_objects = 0;
                        }
                        total_hsn_objects++; // num  should atleast be 1
                        tbl_data = tbl_data[0].det;
                        for (var i = 0; i < tbl_data.length; i++) {


                            var count = 0;

                            for (var j = 0; j < tbldata.det.length; j++) {

                                if (tbldata.det[j].hsn_sc === tbl_data[i].hsn_sc) {
                                    if (!tbldata.det[j].desc)
                                        tbldata.det[j].desc = '';
                                    if (!tbl_data[i].desc)
                                        tbl_data[i].desc = '';


                                    if ((tbldata.det[j].desc).toLowerCase() === (tbl_data[i].desc).toLowerCase()) {

                                        if ((tbldata.det[j].uqc).toLowerCase() === (tbl_data[i].uqc).toLowerCase()) {
                                            tbl_data[i].num = tbldata.det[j].num;
                                            //todo

                                            tbldata.det.splice(j, 1);
                                            tbldata.det.splice(j, 0, tbl_data[i]);
                                            count = 1;
                                        }
                                    }
                                }
                            }
                            if (count != 1) {

                                tbl_data[i].num = total_hsn_objects;
                                total_hsn_objects++;


                                tbldata.det.push(tbl_data[i]);

                            } else {
                                if (!tbl_data[i].hsn_sc) {
                                    jsonObj.push(tblcd + ":" + tbl_data[i].desc);
                                } else {
                                    jsonObj.push(tblcd + ":" + tbl_data[i].hsn_sc);
                                }

                            }
                        }

                        break;
                    case "nil_supplies": //for  GSTR2
                        logger.log("info", "entered in nil_supplies section");
                        tbldata = gstfile.nil_supplies;
                        tbldata.splice(0, 1);
                        tbldata.push(tbl_data[0]);
                        break;
                    default:
                        logger.log("error", "table_cd not present :: %s", tblcd);
                }

                fs.writeFileSync(filename, JSON.stringify(gstfile)); // write into file after pushing data into it.

                if (jsonObj.length == 0) {
                    logger.log("info", "No duplicate invoice found and data added successfully");
                    if (isSameGSTIN == gstin) {
                        var responsegstin = [];
                        var gstinKey = {};
                        gstinKey.gstin = gstin;
                        responsegstin.push(gstinKey);
                        callback(err, responsegstin);
                    } else {

                        callback(null, "Success! Returns details added.");
                    }
                } else {
                    logger.log("info", "duplicate invoice found and non duplicated rows added successfully");
                    callback(err, jsonObj);
                }
            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While writing into the files :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Data added successfully :: %s", result);
                response.success(result, res)
            }
        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected Error while writing into the file :: %s", err)
        response.error(errorObject, res);
    } finally {
        errorObject = null;
        isSameGSTIN = null;
    }
};



var generateFile = function (req, res) {
    logger.log("info", "Entering Offline File:: generateFile ");
    var errorObject = null;
    try {
        var gstin = req.body.gstin;
        var form = req.body.form;
        var fy = req.body.fy;
        var month = req.body.month;
        var type = req.body.type;
        var fp = req.body.fp;
        var gt = req.body.gt;
        var cur_gt = req.body.cur_gt;
        var filename;
        var impfileName = req.body.returnFileName;
        var dir;
        var gstfileNew;
        let isTPQ = req.body.isTPQ;
        let rtn_prd = parseInt(req.body.fp.slice(0, 2));

        if (type == "Import") {
            dir = uploadedImpFiledir; // to read the imported file whose zip need to be created
            filename = dir + "/" + impfileName.replace("./download", "");
        } else {
            dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month; // to read the file whose zip need to be created
            filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json'

        }

        fs.readFile(filename, 'utf8', function (err, data) {
            if (err) console.log(err);
            else {
                if (type == "Import") {
                    // var gstfileNew = JSON.parse(data);
                    async.waterfall([
                        function (callback) {
                            logger.log("info", "entered in async.waterfall function 1");
                            common.formDataFormat(req, function (formDataFormat) {
                                logger.log("info", "entered in async.waterfall formDataFormat");
                                callback(null, formDataFormat)
                            })
                        },
                        function (formDataFormat, callback) {
                            mkdirp.sync(dir);

                            logger.log("info", " creating formDataFormat of form :: %s ", form);
                            if (!fs.existsSync(dir)) // when user will come first time and no directory is there to save the file.
                            // user will enter only once in this.
                            //After entering  file will get created.
                            {
                                mkdirp(dir, function (err) // if directory is not there will create directory
                                {

                                    if (err) // if we are facing issue in creating the directory
                                    {
                                        logger.log("error", "Unexpected error while creating the directory:: %s", err.message);
                                        callback(err, null)
                                    } else // if we are not facing issue in creating the directory.
                                    {

                                        fs.writeFile(filename, formDataFormat, function (err) // after creating the directory we are creating file inside that in order to save the table data.
                                        {

                                            if (err) // if we are facing issue in creating the file
                                            {
                                                logger.log("error", "Unexpected error while creating the file:: %s", err.message);
                                                callback(err, null);
                                            } else // file is created
                                            {


                                                fs.readFile(filename, 'utf8', function (err, data) {
                                                    if (err) //if we are unable to read the file
                                                    {
                                                        logger.log("error", "Unexpected error while reading the file:: %s", err.message);
                                                        callback(err, null)

                                                    } else // if we are able to read the file
                                                    {
                                                        gstfileNew = JSON.parse(data);
                                                        callback(null, gstfileNew)
                                                    }
                                                });


                                            }

                                        })

                                    }
                                })
                            } else {

                                fs.writeFile(filename, formDataFormat, function (err) // after creating the directory we are creating file inside that in order to save the table data.
                                {
                                    if (err) // if we are facing issue in creating the file
                                    {
                                        logger.log("error", "Unexpected error while creating the file:: %s", err.message);
                                        callback(err, null);
                                    } else // file is created
                                    {


                                        fs.readFile(filename, 'utf8', function (err, data) {
                                            if (err) //if we are unable to read the file
                                            {
                                                logger.log("error", "Unexpected error while reading the file:: %s", err.message);
                                                callback(err, null)

                                            } else // if we are able to read the file
                                            {
                                                gstfileNew = JSON.parse(data);
                                                callback(null, gstfileNew)
                                            }
                                        });


                                    }

                                })
                            }

                        },
                        function (gstfileNew, callback) {
                            logger.log("info", " entering the third function");

                            if (err) console.log(err);
                            else {
                                var gstfile = JSON.parse(data)
                                for (var key in gstfile) {
                                    var value = gstfile[key];
                                    switch (key) {
                                        case "b2b":
                                        // gstfileNew.b2b = value;
                                        // break;
                                        case "b2ba":
                                            var newInv = [];
                                            var genData = [];
                                            var keyObj = {};
                                            var tmp_1 = value.length;
                                            for (var i = 0; i < tmp_1; i++) {

                                                newInv = [];
                                                keyObj.ctin = value[i].ctin;
                                                var tmp_2 = value[i].inv.length;

                                                for (var j = 0; j < tmp_2; j++) {

                                                    // @vasu: adding flag: R, P and A for GSTR2
                                                    if (!value[i].inv[j].hasOwnProperty("flag") || value[i].inv[j].flag === "D" || value[i].inv[j].flag === "A" || value[i].inv[j].flag === "R" || value[i].inv[j].flag === "P" || value[i].inv[j].flag === "M" || value[i].inv[j].flag === "E" || value[i].inv[j].flag === "") {


                                                        /** cloned object is created to delete the flag if flag is M or E*/
                                                        var clonedObject = extend(true, {}, value[i].inv[j]);
                                                        //to delete the checksum : added by prakash
                                                        if (clonedObject.flag !== "A" && clonedObject.flag !== "R") {
                                                            delete clonedObject["chksum"];
                                                        }
                                                        if (clonedObject.updby == 'R' && (clonedObject.flag === "M" || clonedObject.flag === "E"))
                                                            delete clonedObject.flag;
                                                        if (clonedObject.flag === "E" || clonedObject.flag === "P")
                                                            delete clonedObject.flag;
                                                        delete clonedObject["old_inum"];
                                                        delete clonedObject["cflag"];

                                                        //Added by Subrat for 65% related CR
                                                        delete clonedObject["diffval"];
                                                        if (clonedObject.hasOwnProperty('diff_percent')) {

                                                            clonedObject.diff_percent = +clonedObject.diff_percent;
                                                            if (clonedObject.diff_percent != 0.65)
                                                                clonedObject.diff_percent = null;
                                                        }
                                                        if (clonedObject.updby == 'S') {


                                                            if (clonedObject.hasOwnProperty('chksum')) {

                                                                if (value[i].inv[j].hasOwnProperty("isActed")) {

                                                                    delete clonedObject["isActed"];
                                                                    delete clonedObject["updby"];
                                                                    newInv.push(clonedObject);
                                                                }
                                                            }
                                                            else {

                                                                if (value[i].inv[j].hasOwnProperty("isActed"))
                                                                    delete clonedObject["isActed"];

                                                                delete clonedObject["updby"];
                                                                newInv.push(clonedObject);
                                                            }


                                                        }
                                                        else if (clonedObject.updby == 'R') {
                                                            if (value[i].inv[j].hasOwnProperty("isActed")) {
                                                                delete clonedObject["isActed"];
                                                                delete clonedObject["updby"];
                                                                newInv.push(clonedObject);
                                                            }
                                                        }
                                                        else {
                                                            newInv.push(clonedObject);
                                                        }



                                                    }



                                                }
                                                keyObj.inv = newInv
                                                if (newInv.length > 0) {
                                                    genData.push(keyObj);
                                                }

                                                keyObj = {};

                                            }

                                            gstfileNew[key] = genData;
                                            break;
                                        case "b2cl":
                                        case "b2cla":
                                            var newInv = [];
                                            var keyObj = {};
                                            var genData = [];
                                            for (var i = value.length - 1; i >= 0; i--) {

                                                newInv = [];

                                                keyObj.pos = value[i].pos;

                                                for (var j = value[i].inv.length - 1; j >= 0; j--) {

                                                    if (value[i].inv[j].flag === "M" || value[i].inv[j].flag === "E" || value[i].inv[j].flag === "D" || !value[i].inv[j].hasOwnProperty("flag")) {
                                                        var clonedObject = extend(true, {}, value[i].inv[j]);

                                                        if (clonedObject.flag === "E")
                                                            delete clonedObject.flag;
                                                        delete clonedObject["old_inum"];
                                                        //to delete the checksum : added by prakash
                                                        delete clonedObject["chksum"];
                                                        //Added by Subrat for 65% related CR
                                                        delete clonedObject["diffval"];
                                                        if (clonedObject.hasOwnProperty('diff_percent')) {

                                                            clonedObject.diff_percent = +clonedObject.diff_percent;
                                                            if (clonedObject.diff_percent != 0.65)
                                                                clonedObject.diff_percent = null;
                                                        }
                                                        newInv.push(clonedObject);

                                                        keyObj.inv = newInv;
                                                    }


                                                }
                                                if (newInv.length > 0) {
                                                    genData.push(keyObj);
                                                }

                                                keyObj = {};
                                            }

                                            gstfileNew[key] = genData;
                                            break;

                                        case "b2cs":
                                        case "b2csa":
                                            for (var i = value.length - 1; i >= 0; i--) {

                                                if (value[i].flag === "M" || value[i].flag === "D" || value[i].flag === "E" || !value[i].hasOwnProperty("flag")) {

                                                    delete value[i]["uni_key"];
                                                    var clonedObject = extend(true, {}, value[i]);
                                                    if (value[i].flag === "E")
                                                        delete clonedObject.flag;
                                                    //Added by Subrat for 65% related CR
                                                    delete clonedObject["diffval"];

                                                    //to delete the checksum : added by prakash
                                                    delete clonedObject["chksum"];
                                                    if (clonedObject.hasOwnProperty('diff_percent')) {

                                                        clonedObject.diff_percent = +clonedObject.diff_percent;
                                                        if (clonedObject.diff_percent != 0.65)
                                                            clonedObject.diff_percent = null;
                                                    }
                                                    delete clonedObject["sp_typ"];
                                                    gstfileNew[key].push(clonedObject);

                                                }

                                            }
                                            break;
                                        case "cdn":
                                        case "cdnr":
                                        case "cdnra":

                                            var genData = [];
                                            var newInv = [];
                                            var keyObj = {};

                                            for (var i = value.length - 1; i >= 0; i--) {

                                                newInv = [];
                                                keyObj.ctin = value[i].ctin;
                                                for (var j = value[i].nt.length - 1; j >= 0; j--) {

                                                    if (value[i].nt[j].flag === "M" || value[i].nt[j].flag === "E" || value[i].nt[j].flag === "D" || value[i].nt[j].flag === "P" || value[i].nt[j].flag === "R" || value[i].nt[j].flag === "A" || value[i].nt[j].flag === "" || !value[i].nt[j].hasOwnProperty("flag")) {
                                                        delete value[i].nt[j]["old_ntnum"];
                                                        delete value[i].nt[j]["old_inum"];
                                                        //delete value[i].nt[j]["updby"];
                                                        delete value[i].nt[j]["cflag"];
                                                        //deleting rsn since it has been removed from schema - Subrat
                                                        delete value[i].nt[j]["rsn"];
                                                        var clonedObject = extend(true, {}, value[i].nt[j])
                                                        //to delete the checksum : added by prakash
                                                        if (clonedObject.flag !== "A" && clonedObject.flag !== "R") {
                                                            delete clonedObject["chksum"];
                                                        }
                                                        if (clonedObject.updby == 'R' && (clonedObject.flag === "M" || clonedObject.flag === "E"))
                                                            delete clonedObject.flag;

                                                        if (clonedObject.flag === "E" || clonedObject.flag === "P")
                                                            delete clonedObject.flag;
                                                        //Added by Subrat for 65% related CR
                                                        delete clonedObject["diffval"];
                                                        if (clonedObject.hasOwnProperty('diff_percent')) {

                                                            clonedObject.diff_percent = +clonedObject.diff_percent;
                                                            if (clonedObject.diff_percent != 0.65)
                                                                clonedObject.diff_percent = null;
                                                        }
                                                        if (clonedObject.updby == 'S') {

                                                            if (clonedObject.hasOwnProperty('chksum')) {

                                                                if (value[i].nt[j].hasOwnProperty("isActed")) {

                                                                    delete clonedObject["isActed"];
                                                                    delete clonedObject["updby"];
                                                                    newInv.push(clonedObject);
                                                                }
                                                            }
                                                            else {
                                                                if (value[i].nt[j].hasOwnProperty("isActed"))
                                                                    delete clonedObject["isActed"];


                                                                delete clonedObject["updby"];
                                                                newInv.push(clonedObject);
                                                            }

                                                        }
                                                        else if (clonedObject.updby == 'R') {
                                                            if (value[i].nt[j].hasOwnProperty("isActed")) {
                                                                delete clonedObject["isActed"];
                                                                delete clonedObject["updby"];
                                                                newInv.push(clonedObject);
                                                            }
                                                        }
                                                        else {
                                                            newInv.push(clonedObject);
                                                        }


                                                        keyObj.nt = newInv;
                                                    }


                                                }


                                                if (newInv.length > 0) {
                                                    genData.push(keyObj);
                                                }
                                                keyObj = {};
                                            }


                                            //change by J
                                            if (form == 'GSTR1') {
                                                key == "cdn" ? (gstfileNew["cdnr"] = genData) : (gstfileNew[key] = genData);
                                            }
                                            else {
                                                gstfileNew[key] = genData;
                                            }
                                            break;
                                        case "b2bur":
                                            var newb2bur = [];
                                            newb2bur.push({});
                                            newb2bur[0].inv = [];
                                            for (var i = value.length - 1; i >= 0; i--) {


                                                for (var j = value[i].inv.length - 1; j >= 0; j--) {

                                                    if (value[i].inv[j].flag === "M" || value[i].inv[j].flag === "E" || value[i].inv[j].flag === "D" || !value[i].inv[j].hasOwnProperty("flag")) {
                                                        var clonedObject = extend(true, {}, value[i].inv[j])
                                                        if (clonedObject.flag === 'M' || clonedObject.flag === 'E')
                                                            delete clonedObject.flag;
                                                        //Added by Subrat for 65% related CR
                                                        delete clonedObject["diffval"];
                                                        if (clonedObject.hasOwnProperty('diff_percent')) {

                                                            clonedObject.diff_percent = +clonedObject.diff_percent;
                                                            if (clonedObject.diff_percent != 0.65)
                                                                clonedObject.diff_percent = null;
                                                        }
                                                        newb2bur[i].inv.push(clonedObject);

                                                    }


                                                }

                                            }


                                            gstfileNew.b2bur = newb2bur;

                                            break;
                                        case "cdnur":
                                        case "cdnura":
                                            for (var i = value.length - 1; i >= 0; i--) {

                                                if (value[i].flag === "M" || value[i].flag === "E" || value[i].flag === "D" || !value[i].hasOwnProperty("flag")) {

                                                    delete value[i]["old_ntnum"];

                                                    var clonedObject = extend(true, {}, value[i])
                                                    if (clonedObject.flag === 'M' || clonedObject.flag === 'E')
                                                        delete clonedObject.flag;
                                                    //to delete the checksum : added by prakash
                                                    delete clonedObject["chksum"];
                                                    //Added by Subrat for 65% related CR
                                                    delete clonedObject["diffval"];
                                                    //deleting rsn since it has been removed from schema - Subrat
                                                    delete clonedObject["rsn"];
                                                    if (clonedObject.hasOwnProperty('diff_percent')) {

                                                        clonedObject.diff_percent = +clonedObject.diff_percent;
                                                        if (clonedObject.diff_percent != 0.65)
                                                            clonedObject.diff_percent = null;
                                                    }
                                                    gstfileNew[key].push(clonedObject);

                                                }



                                            }

                                            break;
                                        case "imp_g": //GSTR2

                                            for (var i = value.length - 1; i >= 0; i--) {

                                                if (value[i].flag === "M" || value[i].flag === "E" || value[i].flag === "D" || !value[i].hasOwnProperty("flag")) {


                                                    var clonedObject = extend(true, {}, value[i])
                                                    if (clonedObject.flag === 'M' || clonedObject.flag === 'E')
                                                        delete clonedObject.flag;

                                                    gstfileNew.imp_g.push(clonedObject);

                                                }


                                            }

                                            break;

                                        case "imp_s": //GSTR2
                                            for (var i = value.length - 1; i >= 0; i--) {

                                                if (value[i].flag === "M" || value[i].flag === "E" || value[i].flag === "D" || !value[i].hasOwnProperty("flag")) {

                                                    var clonedObject = extend(true, {}, value[i])
                                                    if (clonedObject.flag === 'M' || clonedObject.flag === 'E')
                                                        delete clonedObject.flag;

                                                    gstfileNew.imp_s.push(clonedObject);
                                                }



                                            }

                                            break;
                                        case "txi": //GSTR2
                                            for (var i = value.length - 1; i >= 0; i--) {

                                                if (value[i].flag === "M" || value[i].flag === "E" || value[i].flag === "D" || !value[i].hasOwnProperty("flag")) {

                                                    var clonedObject = extend(true, {}, value[i])
                                                    if (clonedObject.flag === 'M' || clonedObject.flag === 'E')
                                                        delete clonedObject.flag;
                                                    gstfileNew.txi.push(clonedObject);

                                                }



                                            }
                                            break;

                                        case "at":
                                        case "ata":
                                            for (var i = value.length - 1; i >= 0; i--) {

                                                if (value[i].flag === "M" || value[i].flag === "D" || value[i].flag === "E" || !value[i].hasOwnProperty("flag")) {

                                                    var clonedObject = extend(true, {}, value[i]);
                                                    if (value[i].flag === "E")
                                                        delete clonedObject.flag;
                                                    //to delete the checksum : added by prakash
                                                    delete clonedObject["chksum"];
                                                    //Added by Subrat for 65% related CR
                                                    delete clonedObject["diffval"];
                                                    if (clonedObject.hasOwnProperty('diff_percent')) {

                                                        clonedObject.diff_percent = +clonedObject.diff_percent;
                                                        if (clonedObject.diff_percent != 0.65)
                                                            clonedObject.diff_percent = null;
                                                    }
                                                    gstfileNew[key].push(clonedObject);

                                                }



                                            }
                                            break;

                                        case "txpd":
                                        case "txpda":
                                        case "atadj":
                                        case "atadja":
                                            if (form == "GSTR1") {

                                                for (var i = value.length - 1; i >= 0; i--) {

                                                    if (value[i].flag === "M" || value[i].flag === "D" || value[i].flag === "E" || !value[i].hasOwnProperty("flag")) {
                                                        var clonedObject = extend(true, {}, value[i]);
                                                        if (value[i].flag === "E")
                                                            delete clonedObject.flag;
                                                        //to delete the checksum : added by prakash
                                                        delete clonedObject["chksum"];
                                                        //Added by Subrat for 65% related CR
                                                        delete clonedObject.diffval;
                                                        if (clonedObject.hasOwnProperty('diff_percent')) {

                                                            clonedObject.diff_percent = +clonedObject.diff_percent;
                                                            if (clonedObject.diff_percent != 0.65)
                                                                clonedObject.diff_percent = null;
                                                        }
                                                        if (key == "txpd" || key == "atadj") {

                                                            if (!gstfileNew.atadj)
                                                                gstfileNew.atadj = [];
                                                            if (!gstfileNew.txpd)
                                                                gstfileNew.txpd = [];
                                                            gstfileNew.atadj.push(clonedObject);
                                                        }
                                                        else {
                                                            if (!gstfileNew.atadja)
                                                                gstfileNew.atadja = [];

                                                            if (!gstfileNew.txpda)
                                                                gstfileNew.txpda = [];
                                                            gstfileNew.txpda.push(clonedObject);

                                                        }


                                                    }


                                                }
                                            } else {
                                                for (var i = value.length - 1; i >= 0; i--) {

                                                    if (value[i].flag === "E" || value[i].flag === "M" || value[i].flag === "D" || !value[i].hasOwnProperty("flag")) {

                                                        var clonedObject = extend(true, {}, value[i])
                                                        if (clonedObject.flag === 'M' || clonedObject.flag === 'E')
                                                            delete clonedObject.flag;
                                                        gstfileNew.atadj.push(clonedObject);
                                                    }

                                                }
                                            }


                                            break;
                                        case "exp":
                                        case "expa":
                                            var genData = [];
                                            var newInv = [];
                                            var keyObj = {};
                                            for (var i = value.length - 1; i >= 0; i--) {
                                                newInv = [];
                                                keyObj.exp_typ = value[i].exp_typ;
                                                for (var j = value[i].inv.length - 1; j >= 0; j--) {

                                                    if (value[i].inv[j].flag === "M" || value[i].inv[j].flag === "D" || value[i].inv[j].flag === "E" || !value[i].inv[j].hasOwnProperty("flag")) {
                                                        var clonedObject = extend(true, {}, value[i].inv[j]);

                                                        if (clonedObject.flag === 'E')
                                                            delete clonedObject.flag;
                                                        //to delete the checksum : added by prakash
                                                        delete clonedObject["chksum"];

                                                        //Added by Subrat for 65% related CR
                                                        delete clonedObject["diffval"];
                                                        if (clonedObject.hasOwnProperty('diff_percent')) {

                                                            clonedObject.diff_percent = +clonedObject.diff_percent;
                                                            if (clonedObject.diff_percent != 0.65)
                                                                clonedObject.diff_percent = null;
                                                        }
                                                        newInv.push(clonedObject);


                                                        keyObj.inv = newInv;
                                                    }


                                                }


                                                if (newInv.length > 0) {
                                                    genData.push(keyObj);
                                                }
                                                keyObj = {};
                                            }

                                            gstfileNew[key] = genData;


                                            break;
                                        case "nil":
                                            var clone = value;

                                            //to delete checksum- added by Pavani
                                            if (clone.chksum)
                                                delete clone.chksum;

                                            //to check whether nil was updated or not-added by prakash
                                            if (clone.flag) {
                                                if (clone.flag == 'E') {
                                                    delete clone.flag;
                                                    gstfileNew[key] = clone;
                                                }

                                            }
                                            else {
                                                gstfileNew[key] = clone;
                                            }


                                            break;
                                        case "doc_issue":

                                            var tblAray = value.doc_det;
                                            for (var tIndex = tblAray.length - 1; tIndex > 0; tIndex--) {
                                                if (tblAray[tIndex].docs.length === 0) {

                                                    tblAray.splice(tIndex, 1);
                                                }
                                            }
                                            if (!value['flag'] || value.flag !== 'N') {
                                                delete value["chksum"];
                                                gstfileNew[key] = value;
                                            }

                                            break;
                                        case "hsn":
                                            var clonedObj = value;
                                            delete clonedObj.chksum;
                                            gstfileNew.hsn = clonedObj;

                                            break;
                                        case "itc_rvsl":

                                            if (value.flag === "E" || value.flag === "M" && value.flag === "D" || !value.hasOwnProperty("flag")) {
                                                gstfileNew.itc_rvsl = value;
                                            }



                                            break;
                                        case "nil_supplies":
                                            if (value.flag === "E" || value.flag === "M" && value.flag === "D" || !value.hasOwnProperty("flag")) {
                                                gstfileNew.nil_supplies = value;
                                            }

                                            break;
                                        case "hsnsum":
                                            var newHsnsum = {};
                                            newHsnsum.det = [];

                                            if (typeof value.length !== 'undefined') {
                                                var tmp_val = value;
                                                value = {}
                                                value.det = tmp_val;
                                            }
                                            if (!value.det)
                                                value.det = [];
                                            for (var j = value.det.length - 1; j >= 0; j--) {
                                                if (value.det[j].flag === "E" || value.det[j].flag === "M" || !value.det[j].hasOwnProperty("flag")) {

                                                    var clonedObject = extend(true, {}, value.det[j])
                                                    if (clonedObject.flag === "E" || clonedObject.flag === "M")
                                                        delete clonedObject.flag;
                                                    newHsnsum.det.push(clonedObject)

                                                }
                                                gstfileNew.hsnsum = newHsnsum;

                                            }
                                            if (value.flag == "D") {
                                                gstfileNew.hsnsum = value;
                                            }

                                            break;
                                    }

                                }


                            }


                            gstfileNew.txpd = gstfileNew.atadj;
                            gstfileNew.atadj = [];


                            fs.writeFileSync(filename, JSON.stringify(gstfile));
                            gstfileNew = deleteSec(gstfileNew);

                            delete gstfileNew.mimeType;
                            gstfileNew = fixUQC(gstfileNew);
                            if (form == 'GSTR1') //No M flag for GSTR1
                                gstfileNew = fixFlag(gstfileNew);

                            gstfileNew.cdnur = removePOS(gstfileNew.cdnur, 'cdnur')
                            gstfileNew.cdnura = removePOS(gstfileNew.cdnura, 'cdnura')
                            gstfileNew.cdnr = removePOS(gstfileNew.cdnr, 'cdnr')
                            gstfileNew.cdnra = removePOS(gstfileNew.cdnra, 'cdnra')
                            gstfileNew.b2cs = fixPOS(gstfileNew.b2cs, 'b2cs')



                            gstfileNew = omitEmpty(gstfileNew);
                            if (form == 'GSTR1') {
                                gstfileNew.doc_issue = fixDoc(gstfileNew.doc_issue);


                                gstfileNew.b2cla = fixOldNum(gstfileNew.b2cla, 'b2cla');
                                gstfileNew.b2cl = fixOldNum(gstfileNew.b2cl, 'b2cl');
                                gstfileNew.b2ba = fixOldNum(gstfileNew.b2ba, 'b2ba');
                                gstfileNew.b2b = fixOldNum(gstfileNew.b2b, 'b2b');
                                gstfileNew.expa = fixOldNum(gstfileNew.expa, 'expa');
                                gstfileNew.cdnra = fixOldNum(gstfileNew.cdnra, 'cdnra');
                                gstfileNew.cdnr = fixOldNum(gstfileNew.cdnr, 'cdnr');
                                // gstfileNew.hsn = fixOldNum(gstfileNew.hsn, 'hsn');


                            }
                            // changes added for removing iamt of SEWOP by janhavi - start  
                            for (var key in gstfileNew) {
                                switch (key) {
                                    case "b2b":
                                    case "b2ba":
                                        if (gstfileNew[key] != null) {
                                            flatObject(gstfileNew[key], key);
                                        }
                                        break;
                                    case "cdnr":
                                    case "cdnra":
                                        if (gstfileNew[key] != null) {
                                            flatObject(gstfileNew[key], key);
                                        }
                                        break;
                                    case "cdnur":
                                    case "cdnura":
                                        if (gstfileNew[key] != null) {
                                            flatObjectCDNUR(gstfileNew[key]);
                                        }
                                        break;
                                    case "exp":
                                    case "expa":
                                        if (gstfileNew[key] != null) {
                                            flatObjectExp(gstfileNew[key]);
                                        }
                                        break;
                                }

                            }
                            // changes for generate JSON CR 18639
                            if (isTPQ && rtn_prd % 3 !== 0) {
                                for (var key in gstfileNew) {
                                    if (key != 'b2b' && key != 'cdnr' && key != 'b2ba' && key != 'cdnra' && key != 'gstin' && key != 'fp' && key != 'version' && key != 'hash') {
                                        delete gstfileNew[key];
                                    }
                                }
                            }
                            if (form == 'GSTR2' && gstfileNew.cdnr && !gstfileNew.cdn) {
                                gstfileNew.cdn = gstfileNew.cdnr;
                                gstfileNew.cdnr = [];
                            }

                            gstfileNew = omitEmpty(gstfileNew);
                            gstfileNew = removeUnEssentialKeys(gstfileNew, form);
                            var respObj = {};
                            var byteSize = jsonSize(JSON.stringify(gstfileNew));

                            if (byteSize < max_size) {


                                var gen_dir = "./public/generatedFile/";
                                var sys_date = new Date();
                                var date_stamp = sys_date.getDate() + '-' + (sys_date.getMonth() + 1) + '-' + sys_date.getFullYear() + '_' + (sys_date.getHours()) + 'h' + '_' + sys_date.getMinutes() + 'm' + '_' + sys_date.getSeconds() + 's';
                                var fp_date = (sys_date.getDate()).toString() + (sys_date.getMonth() + 1).toString() + (sys_date.getFullYear()).toString();
                                var single_dir = gen_dir + date_stamp + "/";
                                mkdirp(single_dir, function (err) {
                                    if (err) {
                                        logger.log("error", "error while creating the directory :: %s ", err.message);
                                    }
                                });


                                fs.writeFile(single_dir + "returns" + "_" + fp_date + "_" + form.substring(3) + "_" + gstin + "_" + "offline" + ".json", JSON.stringify(gstfileNew), function (err) {

                                    if (err) {
                                        console.log(err)
                                        // something went wrong, file probably not written.
                                        return callback(err);
                                    }

                                    fs.exists(single_dir + "returns" + "_" + fp_date + "_" + form.substring(3) + "_" + gstin + "_" + "offline" + ".json", function (exists) {
                                        if (exists) {
                                            // do stuff
                                            respObj.down_dir = single_dir.replace("./public/", "");

                                            var filenameArr = [];


                                            fs.readdir(single_dir, function (err, files) {

                                                if (err) {
                                                    console.log(err);
                                                } else {
                                                    for (var i = 0; i < files.length; i++) {

                                                        if (path.extname(files[i]) === ".json") {

                                                            filenameArr.push(files[i]);
                                                            respObj.filenameArr = filenameArr;
                                                        }
                                                    }
                                                }
                                                res.send(respObj)
                                                res.end();
                                            });
                                        }
                                    });

                                });

                            }
                            else {


                                req.body.gstfileNew = gstfileNew;
                                req.body.max_size = max_size;
                                req.body.form = form;
                                req.body.fp = fp;
                                req.body.gstin = gstin;
                                req.body.gt = gt;
                                req.body.cur_gt = cur_gt;
                                req.body.fy = fy;
                                req.body.month = month;
                                common.chunk(req, function (dir) {

                                    logger.log("info", "getting response from common.js");

                                    respObj.down_dir = dir.replace("./public/", "");

                                    var filenameArr = []
                                    fs.readdir(dir, function (err, files) {

                                        if (err) {
                                            console.log(err);
                                        }
                                        else {
                                            for (var i = 0; i < files.length; i++) {

                                                if (path.extname(files[i]) === ".json") {

                                                    filenameArr.push(files[i]);
                                                    respObj.filenameArr = filenameArr;
                                                }
                                            }
                                        }
                                        res.send(respObj)
                                        res.end();
                                    });

                                });

                            }


                        }



                    ], function (err, result) {
                        logger.log("info", "entered in async.waterfall function")
                        if (err) {
                            errorObject = {
                                statusCd: err,
                                errorCd: err,
                            };
                            logger.log("error", "Error While adding the invoices :: %s", errorObject);
                            response.error(errorObject, res);
                        } else {
                            logger.log("info", "Return Details Added Successfully :: %s", result);
                            response.success(result, res)
                        }

                    })
                } else {
                    var gstfile = JSON.parse(data);

                    gstfile.txpd = gstfile.atadj;
                    gstfile.atadj = [];
                    gstfile.txpda = gstfile.atadja;
                    gstfile.atadja = [];

                    // dont remove this
                    if (form == 'GSTR2') {
                        gstfile.cdn = gstfile.cdnr;
                        gstfile.cdnr = [];

                        var tmp = {}
                        if (typeof gstfile.itc_rvsl.length !== 'undefined') {

                            gstfile.itc_rvsl.forEach(function (item) {
                                var key = Object.keys(item)[0];  //take the first key from every object in the array

                                tmp[key] = item[key];   //assign the key and value to output obj
                            });
                            gstfile.itc_rvsl = tmp;
                        }
                        /*code to remove the suppier name from json*/
                        if (!_.isEmpty(gstfile.b2bur)) {
                            var inv_in = gstfile.b2bur[0].inv;
                            var newInv = [];
                            _.forEach(inv_in, function (inv) {
                                newInv.push(_.omit(inv, 'sup_name'));
                            })
                            gstfile.b2bur[0].inv = newInv;
                        }

                    }

                    gstfile = omitEmpty(gstfile);
                    gstfile = fixUQC(gstfile);
                    delete gstfile.mimeType;
                    gstfile.b2ba = removeCName(gstfile.b2ba, 'b2ba')
                    gstfile.b2b = removeCName(gstfile.b2b, 'b2b')
                    gstfile.cdnr = removeCName(gstfile.cdnr, 'cdnr')
                    gstfile.cdnra = removeCName(gstfile.cdnra, 'cdnra')

                    if (form == 'GSTR1') {

                        gstfile.doc_issue = fixDoc(gstfile.doc_issue);
                        gstfile.b2cla = fixOldNum(gstfile.b2cla, 'b2cla');
                        gstfile.b2ba = fixOldNum(gstfile.b2ba, 'b2ba');
                        gstfile.b2cl = fixOldNum(gstfile.b2cl, 'b2cl');
                        gstfile.b2b = fixOldNum(gstfile.b2b, 'b2b');
                        gstfile.expa = fixOldNum(gstfile.expa, 'expa');
                        gstfile.cdnra = fixOldNum(gstfile.cdnra, 'cdnra');
                        gstfile.cdnr = fixOldNum(gstfile.cdnr, 'cdnr');
                        gstfile.cdnur = fixOldNum(gstfile.cdnur, 'cdnur');
                        gstfile.cdnura = fixOldNum(gstfile.cdnura, 'cdnura');
                        // gstfile.hsn = fixOldNum(gstfile.hsn, 'hsn');

                        //removing an attribute related to 65% CR - Subrat
                        //removing null values for inv_typ in few sections
                        gstfile.b2b = fixDiffVal(gstfile.b2b, 'b2b');
                        gstfile.b2ba = fixDiffVal(gstfile.b2ba, 'b2ba');
                        gstfile.b2cs = fixDiffVal(gstfile.b2cs, 'b2cs');
                        gstfile.b2csa = fixDiffVal(gstfile.b2csa, 'b2csa');
                        gstfile.b2cl = fixDiffVal(gstfile.b2cl, 'b2cl');
                        gstfile.b2cla = fixDiffVal(gstfile.b2cla, 'b2cla');
                        gstfile.cdnr = fixDiffVal(gstfile.cdnr, 'cdnr');
                        gstfile.cdnra = fixDiffVal(gstfile.cdnra, 'cdnra');
                        gstfile.cdnur = fixDiffVal(gstfile.cdnur, 'cdnur');
                        gstfile.cdnura = fixDiffVal(gstfile.cdnura, 'cdnura');
                        gstfile.exp = fixDiffVal(gstfile.exp, 'exp');
                        gstfile.expa = fixDiffVal(gstfile.expa, 'expa');
                        gstfile.at = fixDiffVal(gstfile.at, 'at');
                        gstfile.ata = fixDiffVal(gstfile.ata, 'ata');
                        gstfile.txpd = fixDiffVal(gstfile.txpd, 'txpd');
                        gstfile.txpda = fixDiffVal(gstfile.txpda, 'txpda');


                    }

                    gstfile.b2cs = fixPOS(gstfile.b2cs, 'b2cs')
                    if (gstfile.b2csa)
                        gstfile.b2csa = fixPOS(gstfile.b2csa, 'b2csa')

                    // changes added for removing iamt of SEWOP by janhavi - start  
                    for (var key in gstfile) {
                        switch (key) {
                            case "b2b":
                            case "b2ba":
                                if (gstfile[key] != null) {
                                    flatObject(gstfile[key], key);
                                }
                                break;
                            case "cdnr":
                            case "cdnra":
                                if (gstfile[key] != null) {
                                    flatObject(gstfile[key], key);
                                }
                                break;
                            case "cdnur":
                            case "cdnura":
                                if (gstfile[key] != null) {
                                    flatObjectCDNUR(gstfile[key]);
                                }
                                break;
                            case "exp":
                            case "expa":
                                if (gstfile[key] != null) {
                                    flatObjectExp(gstfile[key]);
                                }
                                break;
                        }

                    }
                    //changes by janhavi end's here

                    // changes for generate JSON CR 18639
                    if (isTPQ && rtn_prd % 3 !== 0) {
                        for (var key in gstfile) {
                            if (key != 'b2b' && key != 'cdnr' && key != 'b2ba' && key != 'cdnra' && key != 'gstin' && key != 'fp' && key != 'version' && key != 'hash') {
                                delete gstfile[key];
                            }
                        }
                    }

                    //changes made by prakash - start
                    var respObj = {};
                    var byteSize = jsonSize(JSON.stringify(gstfile));

                    if (byteSize < max_size) {
                        var gen_dir = "./public/generatedFile/";
                        var sys_date = new Date();
                        var date_stamp = sys_date.getDate() + '-' + (sys_date.getMonth() + 1) + '-' + sys_date.getFullYear() + '_' + (sys_date.getHours()) + 'h' + '_' + sys_date.getMinutes() + 'm' + '_' + sys_date.getSeconds() + 's';
                        var fp_date = (sys_date.getDate()).toString() + (sys_date.getMonth() + 1).toString() + (sys_date.getFullYear()).toString();
                        var single_dir = gen_dir + date_stamp + "/";
                        mkdirp(single_dir, function (err) {
                            if (err) {
                                logger.log("error", "error while creating the directory :: %s ", err.message);
                            }
                        });


                        fs.writeFile(single_dir + "returns" + "_" + fp_date + "_" + form.substring(3) + "_" + gstin + "_" + "offline" + ".json", JSON.stringify(gstfile), function (err) {

                            if (err) {
                                // something went wrong, file probably not written.
                                return callback(err);
                            }

                            fs.exists(single_dir + "returns" + "_" + fp_date + "_" + form.substring(3) + "_" + gstin + "_" + "offline" + ".json", function (exists) {
                                if (exists) {
                                    // do stuff
                                    respObj.down_dir = single_dir.replace("./public/", "");

                                    var filenameArr = [];


                                    fs.readdir(single_dir, function (err, files) {

                                        if (err) {
                                            console.log(err);
                                        } else {
                                            for (var i = 0; i < files.length; i++) {
                                                if (path.extname(files[i]) === ".json") {

                                                    filenameArr.push(files[i]);
                                                    respObj.filenameArr = filenameArr;
                                                }
                                            }
                                        }
                                        res.send(respObj)
                                        res.end();
                                    });
                                }
                            });

                        });

                    }

                    else {

                        req.body.gstfileNew = gstfile;
                        req.body.max_size = max_size;
                        req.body.form = form;
                        req.body.fp = fp;
                        req.body.gstin = gstin;
                        req.body.gt = gt;
                        req.body.cur_gt = cur_gt;
                        req.body.fy = fy;
                        req.body.month = month;
                        common.chunk(req, function (dir) {
                            logger.log("info", "getting response from common.js");

                            respObj.down_dir = dir.replace("./public/", "");

                            var filenameArr = []
                            fs.readdir(dir, function (err, files) {

                                if (err) {
                                    console.log(err);
                                }
                                else {
                                    for (var i = 0; i < files.length; i++) {

                                        if (path.extname(files[i]) === ".json") {

                                            filenameArr.push(files[i]);
                                            respObj.filenameArr = filenameArr;
                                        }
                                    }
                                }
                                res.send(respObj)
                                res.end();
                            });

                        });

                    }

                    //changes made by prakash - end
                }
            }
        });




    }
    catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected Error");
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};

var flatObject = function (gstfile, key) {
    var gstfileLen = gstfile.length;
    for (var i = 0; i < gstfileLen; i++) {
        let inv = (key == 'b2b' || key == 'b2ba') ? gstfile[i].inv : gstfile[i].nt;
        var invLen = inv.length
        for (var j = 0; j < invLen; j++) {
            if (inv[j].inv_typ == "SEWOP") {
                var itms = inv[j].itms;
                var itmLen = itms.length;
                for (var k = 0; k < itmLen; k++) {
                    itms[k].itm_det.iamt = 0;
                    itms[k].itm_det.csamt = 0;
                }
            }
        }
    }
}

var flatObjectExp = function (gstfile) {
    var gstfileLen = gstfile.length;
    for (var i = 0; i < gstfileLen; i++) {
        if (gstfile[i].exp_typ == "WOPAY") {
            var inv = gstfile[i].inv;
            var invLen = inv.length;
            for (var j = 0; j < invLen; j++) {
                var itms = inv[j].itms;
                var itmLen = itms.length;
                for (var k = 0; k < itmLen; k++) {
                    itms[k].iamt = 0;
                    itms[k].csamt = 0;
                }
            }
        }
    }
}

var flatObjectCDNUR = function (gstfile) {
    var gstfileLen = gstfile.length;
    for (var i = 0; i < gstfileLen; i++) {
        if (gstfile[i].typ == "EXPWOP") {
            var itms = gstfile[i].itms;
            var itmLen = itms.length;
            for (var k = 0; k < itmLen; k++) {
                itms[k].itm_det.iamt = 0;
                itms[k].itm_det.csamt = 0;
            }
        }
    }
}

var deleteallinvoices = function (req, res) {
    var errorObject = null;
    logger.log("info", "Entering Offline File:: deleteallinvoices ");
    try {
        async.waterfall([function (callback) {
            var gstin = req.body.gstin;
            var form = req.body.form;
            var fy = req.body.year;
            var month = req.body.month;
            var filename = './public/userData/' + gstin + '/' + form + '/' + fy + '/' + month + '/*.json';
            del.sync([filename]);
            callback(null, "Return File Deleted")
        }], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While deleting the files :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return File Deleted :: %s", result);
                response.success(result, res)
            }

        })

    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected Error while deleting the file:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};
var deleteMltplInv = function (req, res) {
    logger.log("info", "Entering Offline File:: deleteMltplInv ");
    var errorObject = null;
    try {
        async.waterfall([

            function (callback) {
                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of ctin and respective invoice no. to delete
                var type = req.body.type;
                var impFile = req.body.returnFileName;
                var dir, filename;
                if (type == "Import") {
                    var dir = uploadedImpFiledir;
                    filename = dir + "/" + impFile.replace("./download", "")
                } else {
                    var dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month;
                    filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json';
                }

                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        callback("Unable to read the file for deleting invoices", null)
                    } else {
                        var gstfile = JSON.parse(data);
                        var tbldata;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = gstfile.b2b;
                                } else {
                                    tbldata = gstfile.b2ba;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });
                                    if (arrayFound.length <= 1) {
                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].inv.length == 0 || arrayFound[0].inv.length == 1) {
                                            tbldata.splice(index, 1);
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1);
                                        }
                                    }
                                }
                                break;
                            case "doc_issue":
                                tbldata = gstfile.doc_issue;
                                var tblarray = tbldata.doc_det;
                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tblarray.myFind({ //find the doc_num
                                        'doc_num': invdltArray[i].doc_num
                                    });
                                    if (arrayFound.length != 0) {
                                        var docAry = {};
                                        docAry = arrayFound[0].docs;

                                        var subArrayFound = docAry.myFind({// find the row to delete
                                            'num': invdltArray[i].num
                                        });

                                        if (subArrayFound.length != 0) {

                                            var subIndex = docAry.indexOf(subArrayFound[0]);

                                            docAry.splice(subIndex, 1);//delete the row

                                        }
                                    }
                                }
                                for (var tbLen = 0; tbLen < tblarray.length; tbLen++) {
                                    var restAry = tblarray[tbLen].docs;
                                    for (var j = 0; j < restAry.length; j++) {

                                        restAry[j].num = j + 1;//reset the num property
                                    }
                                }

                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    tbldata = gstfile.b2cl;
                                } else {
                                    tbldata = gstfile.b2cla;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });

                                    if (arrayFound.length <= 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].inv.length == 0 || arrayFound[0].inv.length == 1) {
                                            tbldata.splice(index, 1);
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1);
                                        }
                                    }
                                }
                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    tbldata = gstfile.b2cs;
                                } else {
                                    tbldata = gstfile.b2csa;
                                }
                                var ukey;

                                for (var k = tbldata.length - 1; k >= 0; k--) {
                                    if (tblcd == "b2cs")
                                        ukey = tbldata[k].pos + "_" + tbldata[k].rt + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    else
                                        ukey = tbldata[k].omon + "_" + tbldata[k].pos + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;

                                    for (var i = 0; i < invdltArray.length; i++) {



                                        if (ukey == invdltArray[i].uni_key) {

                                            tbldata.splice(k, 1);
                                        }


                                    }

                                }



                                break;
                            case "cdnr":
                            case "cdnra":

                                if (tblcd == "cdnr") {
                                    tbldata = gstfile.cdnr || gstfile.cdn;
                                } else {
                                    tbldata = gstfile.cdnra;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });

                                    if (arrayFound.length <= 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].nt.length == 0 || arrayFound[0].nt.length == 1) {
                                            tbldata.splice(index, 1);
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].nt;
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1);
                                        }
                                    }
                                }
                                break;
                            case "cdnur":
                            case "cdnura":
                                if (tblcd == "cdnur") {
                                    tbldata = gstfile.cdnur;
                                } else {
                                    tbldata = gstfile.cdnura;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'nt_num': invdltArray[i].nt_num
                                    });

                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        tbldata.splice(index, 1);

                                    }
                                }
                                break;
                            case "nil":
                                tbldata = gstfile.nil;
                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = gstfile.exp;
                                } else {
                                    tbldata = gstfile.expa;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'exp_typ': invdltArray[i].exp_typ
                                    });

                                    if (arrayFound.length <= 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].inv.length == 0 || arrayFound[0].inv.length == 1) {
                                            tbldata.splice(index, 1);
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1);
                                        }
                                    }
                                }
                                break;
                            case "at":
                            case "ata":
                            case "txi":
                            case "txia":
                                if (tblcd == "at") {
                                    tbldata = gstfile.at;
                                } else if (tblcd == 'ata') {
                                    tbldata = gstfile.ata;
                                } else if (tblcd == 'txi') {
                                    tbldata = gstfile.txi;
                                } else if (tblcd == 'txia') {
                                    tbldata = gstfile.txia;
                                }
                                if (form == 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound;
                                    if (tblcd == "at" || tblcd == "ata") {//gstr1
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos
                                        });
                                    }

                                    if (arrayFound.length == 1) //no other case is possible.because delete will be called for existing pos only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "atadj":
                            case "atadja":

                                if (tblcd == "atadj") {
                                    tbldata = gstfile.atadj;
                                } else if (tblcd == 'atadja') {
                                    tbldata = gstfile.atadja;
                                }
                                if (form == "GSTR1") {

                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }

                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because delete will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1);
                                        }
                                    }
                                } else { //for  GSTR2
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because delete will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1);
                                        }
                                    }
                                }
                                break;
                            case "ecom_invocies":
                                tbldata = gstfile.ecom_invocies;
                                break;
                            case "hsn":
                                tbldata = gstfile.hsn;

                                for (var i = 0; i < invdltArray.length; i++) {


                                    var arrayFound = tbldata.data.myFind({
                                        'num': invdltArray[i].num
                                    });

                                    if (arrayFound.length == 1) //no other case is possible.because delete will be called for existing num only.So array found will always have a value of 1.
                                    {

                                        var index = tbldata.data.indexOf(arrayFound[0]);
                                        tbldata.data.splice(index, 1);


                                    }
                                }
                                break;

                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = gstfile.b2bur;
                                } else {
                                    tbldata = gstfile.b2bura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata[0].inv;
                                    var subarrayFound = arrayFound.myFind({
                                        'inum': invdltArray[i].inum
                                    });

                                    if (subarrayFound.length == 1) {

                                        var index = tbldata[0].inv.indexOf(subarrayFound[0]); // to find the index of the object

                                        tbldata[0].inv.splice(index, 1);



                                    } else {
                                        logger.log("info", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "imp_g": //for  GSTR2
                            case "imp_ga": //for  GSTR2
                                if (tblcd == "imp_g") {
                                    tbldata = gstfile.imp_g;
                                } else {
                                    tbldata = gstfile.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    } else {
                                        logger.log("info", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = gstfile.imp_s;
                                } else {
                                    tbldata = gstfile.imp_sa;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    } else {
                                        logger.log("info", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    tbldata = gstfile.txi;
                                } else {
                                    tbldata = gstfile.atxi;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    } else {
                                        logger.log("info", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = gstfile.hsnsum;

                                for (var i = 0; i < invdltArray.length; i++) {


                                    var arrayFound = tbldata.det.myFind({
                                        'num': invdltArray[i].num
                                    });

                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing num only.So array found will always have a value of 1.
                                    {

                                        var index = tbldata.det.indexOf(arrayFound[0]);
                                        tbldata.det.splice(index, 1);


                                    }
                                }
                                break;

                            case "itc_rvsl": //for  GSTR2
                                tbldata = gstfile.itc_rvsl;
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inv_doc_num': invdltArray[i].inv_doc_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    } else {

                                        logger.log("info", "Invoice  does not exist");
                                    }
                                }
                                break;
                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        fs.writeFileSync(filename, JSON.stringify(gstfile));

                        callback(null, "Return document deleted successfully")
                    }

                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While deleting the files :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Invoices deleted successfully :: %s", result);
                response.success(result, res)
            }
        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while deleting the invoices:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};
var upload = function (req, res) {


    var errorObject = null;
    logger.log("info", "Entering Offline File:: upload ");
    try {
        async.waterfall([function (callback) {
            common.upload1(req, res, function (err) {
                if (err) {
                    return callback(err, null);
                } else {

                    var fname = [];
                    for (var i = 0; i < req.files.length; i++) {
                        console.log("req.files[i].filename", req.files[i].filename)
                        console.log("req.files[i].filename", req.files[i])
                        fname.push(req.files[i].filename.replace(/%/g, ""));


                    }
                    return callback(null, fname);

                }
            })

        }], function (err, result) {
            if (err) {
                console.log(err)
            }
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While uploading the files :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return File uploaded successflly :: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {

        console.log(err)
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while uploading:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};


function readFiles(dirname, onFileContent, onError) {
    fs.readdir(dirname, function (err, filenames) {
        if (err) {
            onError(err);
            return;
        }
        console.log("filenames", filenames)
        if (filenames.length == 0) {
            onError('empty zip')
            return;
        } else {
            // all the file names are in array here : filesnames;
            var json_found = false;
            for (var i = 0; i < filenames.length; i++) {
                if (path.extname(filenames[i]) === ".json") {
                    filenames.push[filenames[i]];
                    json_found = true;
                }
            }
            if (!json_found) {

                onError('empty zip');
                return;
            }
        }

        if (filenames.length > 1) {
            var gstfileAtfrst;
            var firstFile = filenames[0];

            fs.readFile(dirname + '/' + firstFile, 'utf-8', function (err, content) {
                if (err) {
                    onError(err);
                    return;
                }

                gstfileAtfrst = JSON.parse(content);


            });


            filenames.forEach(function (filename) {
                fs.readFile(dirname + '/' + filename, 'utf-8', function (err, content) {
                    if (err) {
                        onError(err);
                        return;
                    }



                    if (filename != filenames[0]) {
                        var gstfile = JSON.parse(content);

                        for (var key in gstfile) {
                            var tbldata;
                            var fistTbldata;
                            logger.log("debug", "key is :::", key);
                            switch (key) {
                                case "impg":
                                case "impgsez":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    logger.log("debug", "table data", tbldata);
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    var responseinvce = [];
                                    var keyObj = {};
                                    for (var k = 0; k < tbldata.length; k++) {
                                        keyObj.benum = tbldata[k].benum;
                                        keyObj.portcd = tbldata[k].portcd;
                                        keyObj.bedt = tbldata[k].bedt;
                                        responseinvce.push(keyObj);
                                        var arrayFound = fistTbldata.myFind({
                                            'benum': responseinvce[0].benum,
                                            'portcd': responseinvce[0].portcd,
                                            'bedt': responseinvce[0].bedt
                                        });

                                        if (arrayFound.length == 0) {

                                            logger.log("info", "boe_num match was not found");
                                            fistTbldata.push(tbldata[k]);
                                            tbldata.splice(k, 0);
                                        } else {
                                            logger.log("info", "boe_num match was found");
                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }

                                    break;
                                case "b2b":
                                case "b2ba":

                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                        fistTbldata.push(tbldata[0]);
                                    }


                                    for (var j = 0; j < fistTbldata.length; j++) {

                                        for (var k = tbldata.length - 1; k >= 0; k--) {
                                            if (tbldata.length > 0) {
                                                var arrayFound = fistTbldata.myFind({
                                                    'ctin': tbldata[k].ctin
                                                });

                                                if (arrayFound.length == 0) {
                                                    logger.log("info", "ctin match was not found");
                                                    fistTbldata.push(tbldata[k]);
                                                    tbldata.splice(k, 1);
                                                } else {
                                                    logger.log("info", "ctin match was found");
                                                    for (var i = tbldata[k].inv.length - 1; i >= 0; i--) {
                                                        var responseinvce = [];
                                                        var keyObj = {};
                                                        var subarray = {};
                                                        keyObj.ctin = tbldata[k].ctin;
                                                        keyObj.inum = tbldata[k].inv[i]

                                                        responseinvce.push(keyObj);

                                                        subarray = arrayFound[0].inv;
                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].inum
                                                        });
                                                        if (subArrayFound.length == 0) {

                                                            var subIndex = subarray.indexOf(subArrayFound[0]);


                                                            subarray.push(tbldata[k].inv[i]);
                                                            tbldata[k].inv.splice(i, 1);
                                                            common.findAndReplace(fistTbldata, tbldata[k].ctin, subarray, key);
                                                        }
                                                    }
                                                    if (tbldata[k].inv.length === 0) {
                                                        tbldata.splice(k, 1);
                                                    }

                                                }
                                            }


                                        }



                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;

                                case "doc_issue":

                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = { "doc_det": [] };
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                        //fistTbldata.push(tbldata[0]);
                                    }

                                    for (var k in tbldata) {
                                        fistTbldata[k] = tbldata[k];
                                    }


                                    break;

                                case "b2cl":
                                case "b2cla":

                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                        fistTbldata.push(tbldata[0]);
                                    }


                                    for (var k = 0; k < tbldata.length; k++) {

                                        for (var j = 0; j < fistTbldata.length; j++) {
                                            var arrayFound = fistTbldata.myFind({
                                                'pos': tbldata[k].pos
                                            });

                                            if (arrayFound.length == 0) {
                                                logger.log("info", "pos match was not found");
                                                fistTbldata.push(tbldata[k]);
                                                tbldata.splice(k, 0);
                                            } else {

                                                logger.log("info", "pos match was found");
                                                for (var i = tbldata[k].inv.length - 1; i >= 0; i--) {
                                                    var responseinvce = [];
                                                    var keyObj = {};
                                                    var subarray = {};
                                                    keyObj.pos = tbldata[k].pos;
                                                    keyObj.inum = tbldata[k].inv[i]

                                                    responseinvce.push(keyObj);

                                                    subarray = arrayFound[0].inv;
                                                    var subArrayFound = subarray.myFind({
                                                        'inum': responseinvce[0].inum
                                                    });
                                                    if (subArrayFound.length == 0) {

                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        subarray.push(tbldata[k].inv[i]);
                                                        tbldata[k].inv.splice(i, 1);
                                                        common.findAndReplace(fistTbldata, tbldata[k].pos, subarray, key);
                                                    }
                                                }
                                                if (tbldata[k].inv.length === 0) {
                                                    tbldata.splice(k, 1);
                                                }

                                            }
                                        }


                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;

                                case "b2cs":
                                case "b2csa":

                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                        fistTbldata.push(tbldata[0]);
                                    }

                                    for (var k = 0; k < tbldata.length; k++) {
                                        var count = 0;

                                        for (var j = 0; j < fistTbldata.length; j++) {

                                            if (tbldata[k].pos === fistTbldata[j].pos) {
                                                if (tbldata[k].rt === fistTbldata[j].rt) {
                                                    if (tbldata[k].etin === fistTbldata[j].etin) {

                                                        count = 1;
                                                        logger.log("info", " match was found");
                                                    }

                                                }
                                            }


                                        }


                                        if (count != 1) {
                                            logger.log("info", " match was not found");
                                            fistTbldata.push(tbldata[k]);

                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "cdn":
                                case "cdnr":
                                case "cdnra":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {

                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                        fistTbldata.push(tbldata[0]);
                                    }


                                    for (var k = 0; k < tbldata.length; k++) {

                                        for (var j = 0; j < fistTbldata.length; j++) {
                                            var arrayFound = fistTbldata.myFind({
                                                'ctin': tbldata[k].ctin
                                            });

                                            if (arrayFound.length == 0) {
                                                logger.log("info", "ctin match was not found, cdnr");
                                                fistTbldata.push(tbldata[k]);
                                                tbldata.splice(k, 0);
                                            } else {

                                                logger.log("info", "pos match was found");
                                                for (var i = tbldata[k].nt.length - 1; i >= 0; i--) {
                                                    var responseinvce = [];
                                                    var keyObj = {};
                                                    var subarray = {};
                                                    keyObj.ctin = tbldata[k].ctin;
                                                    keyObj.nt_num = tbldata[k].nt[i]

                                                    responseinvce.push(keyObj);

                                                    subarray = arrayFound[0].nt;
                                                    var subArrayFound = subarray.myFind({
                                                        'nt_num': responseinvce[0].nt_num
                                                    });
                                                    if (subArrayFound.length == 0) {

                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        subarray.push(tbldata[k].nt[i]);
                                                        tbldata[k].nt.splice(i, 1);
                                                        common.findAndReplace(fistTbldata, tbldata[k].ctin, subarray, key);
                                                    }
                                                }
                                                if (tbldata[k].nt.length === 0) {
                                                    tbldata.splice(k, 1);
                                                }

                                            }
                                        }


                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "cdnur":
                                case "cdnura":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    var responseinvce = [];
                                    var keyObj = {};
                                    for (var k = 0; k < tbldata.length; k++) {
                                        keyObj.nt_num = tbldata[k].nt_num;



                                        responseinvce.push(keyObj);




                                        var arrayFound = fistTbldata.myFind({
                                            'nt_num': responseinvce[0].nt_num
                                        });

                                        if (arrayFound.length == 0) {

                                            logger.log("info", "note number match was not found");
                                            fistTbldata.push(tbldata[k]);
                                            tbldata.splice(k, 0);
                                        } else {
                                            logger.log("info", "note number match was found");
                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }

                                    break;
                                case "nil":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = {};
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    //fistTbldata.splice(0, 1);
                                    for (var k in tbldata) {
                                        fistTbldata[k] = tbldata[k];
                                    }


                                    break;
                                case "exp":
                                case "expa":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                        fistTbldata.push(tbldata[0]);
                                    }

                                    for (var k = 0; k < tbldata.length; k++) {

                                        for (var j = 0; j < fistTbldata.length; j++) {
                                            var arrayFound = fistTbldata.myFind({
                                                'exp_typ': tbldata[k].exp_typ
                                            });

                                            if (arrayFound.length == 0) {
                                                logger.log("info", "exp_typ match was not found");
                                                fistTbldata.push(tbldata[k]);
                                                tbldata.splice(k, 0);
                                            } else {

                                                logger.log("info", "exp_typ match was found");
                                                for (var i = tbldata[k].inv.length - 1; i >= 0; i--) {
                                                    var responseinvce = [];
                                                    var keyObj = {};
                                                    var subarray = {};
                                                    keyObj.exp_typ = tbldata[k].exp_typ;
                                                    keyObj.inum = tbldata[k].inv[i]

                                                    responseinvce.push(keyObj);

                                                    subarray = arrayFound[0].inv;
                                                    var subArrayFound = subarray.myFind({
                                                        'inum': responseinvce[0].inum
                                                    });
                                                    if (subArrayFound.length == 0) {

                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        subarray.push(tbldata[k].inv[i]);
                                                        tbldata[k].inv.splice(i, 1);
                                                        common.findAndReplace(fistTbldata, tbldata[k].exp_typ, subarray, key);
                                                    }
                                                }
                                                if (tbldata[k].inv.length === 0) {
                                                    tbldata.splice(k, 1);
                                                }

                                            }
                                        }

                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "at":
                                case "ata":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    for (var k = 0; k < tbldata.length; k++) {
                                        if (fistTbldata.length) {
                                            for (var j = 0; j < fistTbldata.length; j++) {
                                                var arrayFound = fistTbldata.myFind({
                                                    'pos': tbldata[k].pos
                                                });

                                                if (arrayFound.length == 0) {
                                                    logger.log("info", "pos match was not found");
                                                    fistTbldata.push(tbldata[k]);
                                                    tbldata.splice(k, 0);
                                                } else {

                                                    logger.log("info", "pos match was found");
                                                }
                                            }
                                        } else {
                                            logger.log("info", "section was empty");
                                            fistTbldata.push(tbldata[k]);
                                        }

                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "txpd":
                                case "txpda":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    for (var k = 0; k < tbldata.length; k++) {
                                        if (fistTbldata.length) {
                                            for (var j = 0; j < fistTbldata.length; j++) {
                                                var arrayFound = fistTbldata.myFind({
                                                    'pos': tbldata[k].pos
                                                });

                                                if (arrayFound.length == 0) {
                                                    logger.log("info", "pos match was not found");
                                                    fistTbldata.push(tbldata[k]);
                                                    tbldata.splice(k, 0);
                                                } else {

                                                    logger.log("info", "pos match was found");
                                                }
                                            }
                                        } else {
                                            logger.log("info", "section was empty");
                                            fistTbldata.push(tbldata[k]);
                                        }

                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "hsn":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = {
                                            "data": []
                                        };
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    if (tbldata['flag']) //to check whether the payload has "flag" property - prakash
                                    {
                                        fistTbldata['flag'] = tbldata.flag;

                                    }
                                    for (var k = 0; k < tbldata.data.length; k++) {

                                        var count = 0;

                                        if (fistTbldata.data.length) {
                                            for (var j = 0; j < fistTbldata.data.length; j++) {

                                                if (tbldata.data[k].hsn_sc === fistTbldata.data[j].hsn_sc) {

                                                    if (!tbldata.data[k].desc)
                                                        tbldata.data[k].desc = '';
                                                    if (!fistTbldata.data[j].desc)
                                                        fistTbldata.data[j].desc = '';

                                                    if ((tbldata.data[k].desc).toLowerCase() === (fistTbldata.data[j].desc).toLowerCase()) {

                                                        if ((tbldata.data[k].uqc).toLowerCase() === (fistTbldata.data[j].uqc).toLowerCase()) {
                                                            if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, fp)) {
                                                                if (tbldata.data[j].rt == secData.dt[i].data[0].rt) {

                                                                    count++;
                                                                }
                                                            }
                                                            else {
                                                                count++;
                                                            }
                                                        }

                                                    }

                                                }
                                            }
                                        }

                                        if (count != 1) {



                                            fistTbldata.data.push(tbldata.data[k]);

                                        } else {
                                            logger.log("info", " match was found");

                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;

                                case "b2bur":
                                case "b2bura":

                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [{
                                            "inv": []
                                        }];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }

                                    for (var k = tbldata[0].inv.length; k >= 0; k--) {
                                        if (fistTbldata[0].inv.length) {

                                            if (tbldata[0].inv.length > 0) {
                                                var arrayFound = fistTbldata[0].inv;
                                                var subarrayFound = arrayFound.myFind({
                                                    'inum': tbldata[0].inv[k].inum
                                                });

                                                if (subarrayFound.length == 0) {
                                                    logger.log("info", "inum match was not found");
                                                    fistTbldata[0].inv.push(tbldata[0].inv[k]);
                                                    tbldata[0].inv.splice(k, 1);
                                                } else {

                                                    logger.log("info", "inum match was found");
                                                }
                                            }
                                        } else {
                                            logger.log("info", "section was empty");
                                            fistTbldata[0].inv.push(tbldata[0].inv[0]);
                                        }


                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "imp_g":
                                case "imp_ga":

                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    var responseinvce = [];
                                    var keyObj = {};
                                    for (var k = 0; k < tbldata.length; k++) {
                                        keyObj.boe_num = tbldata[k].boe_num;



                                        responseinvce.push(keyObj);




                                        var arrayFound = fistTbldata.myFind({
                                            'boe_num': responseinvce[0].boe_num
                                        });

                                        if (arrayFound.length == 0) {

                                            logger.log("info", "boe_num match was not found");
                                            fistTbldata.push(tbldata[k]);
                                            tbldata.splice(k, 0);
                                        } else {
                                            logger.log("info", "boe_num match was found");
                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }

                                    break;
                                case "imp_s": //for  GSTR2
                                case "imp_sa": //for  GSTR2
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    var responseinvce = [];
                                    var keyObj = {};
                                    for (var k = 0; k < tbldata.length; k++) {
                                        keyObj.inum = tbldata[k].inum;



                                        responseinvce.push(keyObj);




                                        var arrayFound = fistTbldata.myFind({
                                            'inum': responseinvce[0].inum
                                        });

                                        if (arrayFound.length == 0) {

                                            logger.log("info", "inum match was not found");
                                            fistTbldata.push(tbldata[k]);
                                            tbldata.splice(k, 0);
                                        } else {
                                            logger.log("info", "inum match was found");
                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;

                                case "itc_rvsl":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }

                                    fistTbldata = tbldata;
                                    gstfile[key] = fistTbldata;
                                    break;
                                case "txi": //for  GSTR2
                                case "atxi": //for  GSTR2
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = [];
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    for (var k = 0; k < tbldata.length; k++) {
                                        if (fistTbldata.length) {
                                            for (var j = 0; j < fistTbldata.length; j++) {
                                                var arrayFound = fistTbldata.myFind({
                                                    'pos': tbldata[k].pos
                                                });

                                                if (arrayFound.length == 0) {
                                                    logger.log("info", "pos match was not found");
                                                    fistTbldata.push(tbldata[k]);
                                                    tbldata.splice(k, 0);
                                                } else {

                                                    logger.log("info", "pos match was found");
                                                }
                                            }
                                        } else {
                                            logger.log("info", "section was empty");
                                            fistTbldata.push(tbldata[k]);
                                        }

                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "hsnsum":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];
                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = {
                                            "det": []
                                        };
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    for (var k = 0; k < tbldata.det.length; k++) {
                                        // tbl_data[i].data[0].num = total_hsn_objects;
                                        // total_hsn_objects++;

                                        var count = 0;

                                        if (fistTbldata.det.length) {
                                            for (var j = 0; j < fistTbldata.det.length; j++) {

                                                if (tbldata.det[k].hsn_sc === fistTbldata.det[j].hsn_sc) {

                                                    if (!tbldata.det[k].desc)
                                                        tbldata.det[k].desc = '';
                                                    if (!fistTbldata.det[j].desc)
                                                        fistTbldata.det[j].desc = '';



                                                    if ((tbldata.det[k].desc).toLowerCase() === (fistTbldata.det[j].desc).toLowerCase()) {

                                                        if ((tbldata.det[k].uqc).toLowerCase() === (fistTbldata.det[j].uqc).toLowerCase()) {

                                                            count++;
                                                        }

                                                    }

                                                }
                                            }
                                        }

                                        if (count != 1) {



                                            fistTbldata.det.push(tbldata.det[k]);

                                        } else {
                                            logger.log("info", " match was found");

                                        }
                                    }
                                    if (gstfile[key] == "") {
                                        delete gstfile[key];
                                    }
                                    break;
                                case "nil_supplies":
                                    tbldata = gstfile[key];
                                    fistTbldata = gstfileAtfrst[key];

                                    if (typeof (fistTbldata) === "undefined") {
                                        var newkey = key;
                                        var value = {};
                                        gstfileAtfrst[newkey] = value;
                                        fistTbldata = gstfileAtfrst[key];
                                    }
                                    //fistTbldata.splice(0, 1);
                                    for (var k in tbldata) {
                                        fistTbldata[k] = tbldata[k];
                                    }


                                    break;
                                default:
                                    logger.log("debug", "table_cd not present :: %s", key);
                            }

                            fs.writeFileSync(dirname + '/' + firstFile, JSON.stringify(gstfileAtfrst));
                            fs.writeFileSync(dirname + '/' + filename, JSON.stringify(gstfile));

                        }

                    }


                });
            });
            filenames.forEach(function (filename) {
                fs.readFile(dirname + '/' + filename, 'utf-8', function (err, content) {
                    if (err) {
                        onError(err);
                        return;
                    } else if (filename == firstFile) {
                        // calling IFF flow for enabling/disabling radio button
                        var obj = JSON.parse(content);
                        var flag = iffflow(obj);
                        onFileContent(filename, content, flag);
                    } else {
                        fs.unlink(dirname + '/' + filename);
                    }
                });
            });

        } else {
            filenames.forEach(function (filename) {
                fs.readFile(dirname + '/' + filename, 'utf-8', function (err, content) {
                    if (err) {
                        onError(err);
                        return;
                    }
                    // calling IFF flow for enabling/disabling radio button
                    var obj = JSON.parse(content);
                    var flag = iffflow(obj);
                    onFileContent(filename, content, flag);

                });
            });
        }

    });
}



// addind function for IFF to check which section is present in json
var iffflow = function (obj) {
    var rtn_prd = parseInt(obj.fp.slice(0, 2));
    var flagJson = false;
    if (rtn_prd % 3 !== 0) {
        if (obj.hasOwnProperty("error_report")) {
            if ((obj["error_report"]).hasOwnProperty("b2cl") || (obj["error_report"]).hasOwnProperty("b2cla") || (obj["error_report"]).hasOwnProperty("b2cs") || (obj["error_report"]).hasOwnProperty("b2csa") || (obj["error_report"]).hasOwnProperty("cdnur") || (obj["error_report"]).hasOwnProperty("cdnura") || (obj["error_report"]).hasOwnProperty("exp") || (obj["error_report"]).hasOwnProperty("expa") || (obj["error_report"]).hasOwnProperty("at") || (obj["error_report"]).hasOwnProperty("ata") || (obj["error_report"]).hasOwnProperty("atadj") || (obj["error_report"]).hasOwnProperty("atadja") || (obj["error_report"]).hasOwnProperty("nil") || (obj["error_report"]).hasOwnProperty("hsn") || (obj["error_report"]).hasOwnProperty("doc_issue")) {
                flagJson = true;
            }
        }
        else if ((obj.hasOwnProperty("b2cl") || obj.hasOwnProperty("b2cla") || obj.hasOwnProperty("b2cs") || obj.hasOwnProperty("b2csa") || obj.hasOwnProperty("cdnur") || obj.hasOwnProperty("cdnura") || obj.hasOwnProperty("exp") || obj.hasOwnProperty("expa") || obj.hasOwnProperty("at") || obj.hasOwnProperty("ata") || obj.hasOwnProperty("atadj") || obj.hasOwnProperty("atadja") || obj.hasOwnProperty("nil") || obj.hasOwnProperty("hsn") || obj.hasOwnProperty("doc_issue"))) {
            flagJson = true;
        }
    }
    return flagJson;
}

var unzip = function (req, res) {
    logger.log("info", "Entering Offline File:: unzip ");
    var errorObject = null;
    try {
        async.waterfall([function (callback) {

            var fname = req.query.fname;
            logger.log("info", "Entering Offline File:: unzip ");
            var zip = new AdmZip("./public/upload/" + fname);
            zip.extractAllTo( /*target path*/ "./public/upload", /*overwrite*/ true);
            callback(null, "File unzip successfully");
        }], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error during unzip  :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Unzip done successfully :: %s", result);
                response.success(result, res)
            }
        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while deleting the invoices:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};

var unzipError = function (req, res) {
    logger.log("info", "Entering Offline File:: unzipError ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {
                var fname = req.query.fname;
                var folder_name = fname.substr(0, fname.lastIndexOf('.'));
                var folder_name = fname.substr(0, fname.lastIndexOf('.'));
                var zip = new AdmZip("./public/upload/" + fname);
                zip.extractAllTo("./public/error/" + folder_name, true);
                callback(null, "error file unzipped successfully", "./public/error/" + folder_name)
            },
            function (msg, fname, callback) {
                var data = [];
                var i = 0;
                readFiles(fname, function (filename, content, flag) {
                    data[i] = JSON.parse(content);
                    callback(null, {
                        msg: msg,
                        data: data,
                        filename: filename,
                        path: fname,
                        flag: flag
                    });
                }, function (err) {
                    throw err;
                    callback(err);
                });
            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While unzipping the error zip:: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Unzipping successful for the error zip :: %s", result);
                response.success(result, res)
            }
        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while unzipping :: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};
var unzipFile = function (req, res) {
    logger.log("info", "Entering Offline File:: unzipFile ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {
                var fname = req.body.fname;
                var ranDnum = Math.floor((Math.random() * 100000) + 1);
                var folder_name = "extract_folder" + "_" + ranDnum;
                for (var indexExtr = 0; indexExtr < fname.length; indexExtr++) {
                    var zip = new AdmZip("./public/upload/" + fname[indexExtr]);
                    zip.extractAllTo("./public/download/" + folder_name, true);
                }

                callback(null, "file unzipped successfully", "./public/download/" + folder_name)
            },
            function (msg, fname, callback) {
                var data = [];
                var i = 0;
                //added flag inside readfiles which is coming from iffFlow function and returning it to returns.Ctrl.js
                readFiles(fname, function (filename, content, flag) {
                    data[i] = JSON.parse(content);
                    callback(null, {
                        msg: msg,
                        data: data,
                        filename: filename,
                        path: fname,
                        flag: flag
                    });
                }, function (err) {
                    throw err;
                });
            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While unzipping the zip:: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Unzipping successful for the zip :: %s", result);
                response.success(result, res)
            }
        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while unzipping :: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};

var importFile = function (req, res) {
    logger.log("info", "Entering Offline File:: importFile ");
    var fname = req.body.fname;
    fname = "/../public/upload/"+ fname;
    try{
        var content = fs.readFileSync(__dirname + fname, "utf8");
        var mstrfile = JSON.parse(JSON.stringify(content));
        console.log("mstrfile :",mstrfile)
        res.send(mstrfile);
       }catch(err){
     logger.log("error", "exception while saving the file..");
        // console.log("err :;",err)
        res.status(404).end();
    }
};

var updatetbldata = function (req, res) {
    logger.log("info", "Entering Offline File:: updatetbldata ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {
                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var tbl_data = req.body.tbl_data;

                var impfileName = req.body.returnFileName;
                var dir;
                logger.log("info", "Entering Offline File:: updatetbldata with tbl_data :: %s", tbl_data);
                logger.log("info", "Entering Offline File:: updatetbldata with tblcd :: %s", tblcd);
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of ctin and respective invoice no. to update
                var type = req.body.type;
                var filename;
                if (type == "Upload") {
                    dir = uploadedFiledir + gstin + "_" + form + "_" + fy + "_" + month;
                    filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';
                } else if (type == "Error") {
                    dir = uploadedFiledir + Error;
                    filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';
                } else if (type == "Import") {
                    dir = uploadedImpFiledir;
                    filename = dir + "/" + impfileName.replace("./download", "");
                } else {
                    dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month;
                    filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json';
                }
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        if (type == "Upload") {
                            logger.log("error", "error while reading the file :: %s ", err.message);
                            callback("Entered details are not correct", null)
                        } else {
                            logger.log("error", "error while reading the file :: %s ", err.message);
                            callback(err, null)
                        }
                    } else {
                        var gstfile = JSON.parse(data);
                        logger.log("info", " gstfile:: %s", gstfile);
                        var tbldata;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = gstfile.b2b;
                                } else {
                                    tbldata = gstfile.b2ba;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });
                                    if (arrayFound.length <= 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].inv.length == 0 || arrayFound[0].inv.length == 1) {

                                            tbldata.splice(index, 1); //delete row first with matched ctin
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        } else {

                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1); //delete row first with matched inum

                                            var arrayFound = tbldata.myFind({
                                                'ctin': tbl_data[i].ctin
                                            });
                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, tbl_data[i]);
                                            } else {
                                                var subarray = {};
                                                subarray = arrayFound[0].inv;
                                                subarray.splice(subIndex, 0, tbl_data[i].inv[0]); //insert updated row in the same index of previous row
                                                common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);
                                            }

                                        }
                                    }

                                }
                                break;
                            case "doc_issue":
                                tbldata = gstfile.doc_issue;

                                if (tbldata['flag']) {
                                    delete tbldata['flag'];
                                }
                                var tblarray = tbldata.doc_det;

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tblarray.myFind({
                                        'doc_num': invdltArray[0].doc_num
                                    });

                                    if (arrayFound.length != 0) { // if doc_num already exists
                                        var docAry = {};
                                        docAry = arrayFound[0].docs;
                                        for (var inputRow = 0; inputRow < invdltArray[0].docs.length; inputRow++) {
                                            var subArrayFound = docAry.myFind({
                                                'num': invdltArray[0].docs[inputRow].num
                                            });

                                            if (subArrayFound.length != 0) {

                                                var subIndex = docAry.indexOf(subArrayFound[0]);
                                                docAry.splice(subIndex, 1);
                                                docAry.splice(subIndex, 0, invdltArray[0].docs[inputRow])

                                            }
                                            else {
                                                docAry.push(invdltArray[0].docs[inputRow]);
                                            }

                                        }

                                    }
                                    else //if doc_num does not exist
                                    {

                                        tblarray.push(invdltArray[i]);
                                    }



                                }
                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    tbldata = gstfile.b2cl;
                                } else {
                                    tbldata = gstfile.b2cla;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });

                                    if (arrayFound.length == 1) {
                                        var subarray = {};
                                        subarray = arrayFound[0].inv;
                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        var subIndex = subarray.indexOf(subArrayFound[0]);
                                        subarray.splice(subIndex, 1); //delete row first with matched inum

                                        var arrayFound = tbldata.myFind({
                                            'pos': tbl_data[i].pos
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(subIndex, 0, tbl_data[i]);
                                        } else {
                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            subarray.splice(subIndex, 0, tbl_data[i].inv[0]); //insert updated row in the same index of previous row
                                            common.findAndReplace(tbldata, tbl_data[i].pos, subarray, tblcd);
                                        }

                                    }
                                }


                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    tbldata = gstfile.b2cs;
                                } else {
                                    tbldata = gstfile.b2csa;
                                }
                                var compArr = [];
                                var count = 0;
                                var ukey;
                                for (var k = 0; k < tbldata.length; k++) {
                                    if (tblcd == "b2cs") {
                                        ukey = tbldata[k].pos + "_" + tbldata[k].rt + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }
                                    else {
                                        ukey = tbldata[k].omon + "_" + tbldata[k].pos + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }
                                    compArr.push(ukey);

                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var j = 0; j < compArr.length; j++) {

                                        if (compArr[j] === invdltArray[i].uni_key) {

                                            tbl_data = tbl_data.filter(function (props) {
                                                delete props.uni_key;
                                                return true;
                                            });

                                            tbldata.splice(j, 1);
                                            tbldata.splice(j, 0, tbl_data[0]);
                                        }

                                    }

                                }
                                break;
                            case "cdnr":
                            case "cdnra":
                                if (tblcd == "cdnr") {
                                    tbldata = gstfile.cdnr;
                                } else {
                                    tbldata = gstfile.cdnra;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });
                                    if (arrayFound.length <= 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].nt.length == 0 || arrayFound[0].nt.length == 1) {

                                            tbldata.splice(index, 1); //delete row first with matched ctin
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        } else {

                                            var subarray = {};
                                            subarray = arrayFound[0].nt;
                                            var subArrayFound2 = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                            if (!invdltArray[i].old_ntnum) {
                                                invdltArray[i].old_ntnum = '';
                                            }
                                            if (subArrayFound2.length > 0 && invdltArray[i].old_ntnum != '' && invdltArray[i].nt_num != invdltArray[i].old_ntnum) {
                                                // new invoice already exist\

                                                callback({
                                                    code: 400,
                                                    msg: "Another note already exist with the same note number"
                                                }, "Another note already exist with the same note number")
                                                return;
                                            }
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].old_ntnum ? invdltArray[i].old_ntnum : invdltArray[i].nt_num
                                            });


                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1); //delete row first with matched inum

                                            var arrayFound = tbldata.myFind({
                                                'ctin': tbl_data[i].ctin
                                            });
                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, tbl_data[i]);
                                            } else {
                                                var subarray = {};
                                                subarray = arrayFound[0].nt;
                                                subarray.splice(subIndex, 0, tbl_data[i].nt[0]); //insert updated row in the same index of previous row
                                                common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);
                                            }

                                        }
                                    }

                                }
                                break;
                            case "cdnur":
                            case "cdnura":

                                if (tblcd == "cdnur") {
                                    tbldata = gstfile.cdnur;
                                } else {
                                    tbldata = gstfile.cdnura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.myFind({
                                        'nt_num': invdltArray[i].nt_num
                                    });
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing nt_num only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1); //delete row first with matched doc_num
                                        tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                    }
                                }
                                break;
                            case "nil":
                                tbldata = gstfile.nil;
                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = gstfile.exp;
                                } else {
                                    tbldata = gstfile.expa;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'exp_typ': invdltArray[i].exp_typ
                                    });
                                    if (arrayFound.length <= 1) {

                                        var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object
                                        if (arrayFound[0].inv.length == 0 || arrayFound[0].inv.length == 1) {
                                            tbldata.splice(index, 1); //delete row first with matched ctin
                                            tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                        } else {

                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            subarray.splice(subIndex, 1); //delete row first with matched inum
                                            var arrayFound = tbldata.myFind({
                                                'exp_typ': tbl_data[i].exp_typ
                                            });
                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, tbl_data[i]);
                                            } else {
                                                var subarray = {};
                                                subarray = arrayFound[0].inv;
                                                subarray.splice(subIndex, 0, tbl_data[i].inv[0]); //insert updated row in the same index of previous row
                                                common.findAndReplace(tbldata, tbl_data[i].exp_typ, subarray, tblcd);
                                            }

                                        }
                                    }

                                }
                                break;
                            case "at":

                                tbldata = gstfile.at;
                                if (form == 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (form == 'GSTR1') {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    }
                                    else {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos

                                        });
                                    }
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing pos only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1); //delete row first with matched doc_num
                                        tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                    }
                                }
                                break;
                            case "ata":
                                tbldata = gstfile.ata;
                                if (form == 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (form == 'GSTR1') {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'omon': invdltArray[i].omon,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    }
                                    else {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'omon': invdltArray[i].omon
                                        });
                                    }
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing pos only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1); //delete row first with matched doc_num
                                        tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                    }
                                }
                                break;
                            case "atadj":

                                tbldata = gstfile.atadj;

                                if (form == "GSTR1") {
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }

                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty
                                            tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                        }
                                    }
                                } else { //for  GSTR2
                                    //ergtergter
                                    tbldata = gstfile.atadj;
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty
                                            tbldata.splice(index, 0, tbl_data[j]); //insert updated row in the same index of previous row
                                        } else {
                                            logger.log("error", "Invoice  does not exist");
                                        }
                                    }

                                }

                                break;
                            case "atadja":

                                tbldata = gstfile.atadja;

                                if (form == "GSTR1") {
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'omon': invdltArray[i].omon,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty
                                            /* for (var i = 0; i < tbl_data.length; i++) {*/
                                            tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                            /* }*/
                                        }
                                    }
                                } else { //for  GSTR2
                                    //ergtergter
                                    tbldata = gstfile.atadj;
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty
                                            tbldata.splice(index, 0, tbl_data[j]); //insert updated row in the same index of previous row
                                        } else {
                                            logger.log("error", "Invoice  does not exist");
                                        }
                                    }

                                }
                                break;
                            case "ecom_invocies":
                                tbldata = gstfile.ecom_invocies;
                                break;
                            case "hsn":
                                tbldata = gstfile.hsn;

                                if (tbldata['flag']) {
                                    delete tbldata['flag'];
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.data.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing num only.So array found will always have a value of 1.
                                    {

                                        var index = tbldata.data.indexOf(arrayFound[0]);
                                        tbldata.data.splice(index, 1);
                                        tbldata.data.splice(index, 0, tbl_data[0].data[0]);

                                    }
                                }
                                break;
                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = gstfile.b2bur;
                                } else {
                                    tbldata = gstfile.b2bura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata[0].inv;
                                    var subarrayFound = arrayFound.myFind({
                                        'inum': invdltArray[i].inum
                                    });

                                    if (subarrayFound.length == 1) {
                                        var index = tbldata[0].inv.indexOf(subarrayFound[0]); // to find the index of the object
                                        tbldata[0].inv.splice(index, 1); //delete the matched invoice

                                        var arrayFound = tbldata[0].inv;
                                        var subarrayFound = arrayFound.myFind({
                                            'inum': tbl_data[i].inum
                                        });
                                        if (subarrayFound.length == 0) {
                                            for (var k = 0; k < tbl_data[i].inv.length; k++) {
                                                tbldata[0].inv.splice(index, 0, tbl_data[i].inv[k]); //insert updated row in the same index of previous row
                                            }
                                        }
                                    }
                                }
                                break;
                            case "imp_g":
                            case "imp_ga":
                                if (tblcd == "imp_g") {
                                    tbldata = gstfile.imp_g;
                                } else {
                                    tbldata = gstfile.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                        var arrayFound = tbldata.myFind({
                                            'boe_num': tbl_data[i].boe_num
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }
                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = gstfile.imp_s;

                                } else {
                                    tbldata = gstfile.imp_sa;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                        var arrayFound = tbldata.myFind({
                                            'inum': tbl_data[i].inum
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }
                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    tbldata = gstfile.txi;
                                } else {
                                    tbldata = gstfile.atxi;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                        var arrayFound = tbldata.myFind({
                                            'pos': tbl_data[i].pos
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }
                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = gstfile.hsnsum;

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.det.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing num only.So array found will always have a value of 1.
                                    {

                                        var index = tbldata.det.indexOf(arrayFound[0]);
                                        tbldata.det.splice(index, 1);
                                        tbldata.det.splice(index, 0, tbl_data[0].det[0]);

                                    }
                                }
                                break;



                            case "itc_rvsl": //for  GSTR2
                                tbldata = gstfile.itc_rvsl;
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inv_doc_num': invdltArray[i].inv_doc_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                        var arrayFound = tbldata.myFind({
                                            'inv_doc_num': tbl_data[i].inv_doc_num
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }
                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        if (type == "Upload") {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document updated successfully")
                        } else {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document updated successfully")

                        }

                    }
                });
            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                if (err.code) {
                    errorObject = {
                        statusCd: err.code,
                        errorCd: err.code,
                        errorMsg: err.msg,
                    };
                } else {
                    errorObject = {
                        statusCd: err,
                        errorCd: err,
                    };
                }

                logger.log("info", "Error While updating the documents :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Document updated successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};
var updateerrdata = function (req, res) {
    logger.log("info", "Entering Offline File:: updateerrdata ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {


                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var fileName = req.body.errFileName;
                var tbl_data = req.body.tbl_data;
                var dir;
                logger.log("info", "Entering Offline File:: updateerrdata with tbl_data :: %s", tbl_data);
                logger.log("info", "Entering Offline File:: updateerrdata with tblcd :: %s", tblcd);
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of ctin and respective invoice no. to update
                var type = req.body.type;
                var filename;
                dir = uploadedErrdir;
                filename = dir + "/" + fileName.replace("./error", "");
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(err, null)
                    } else {
                        var gstfile = JSON.parse(data);
                        var errorData = gstfile.error_report;
                        logger.log("info", " gstfile:: %s", errorData);
                        var tbldata;
                        if (form == "GSTR1" && tblcd == "hsnsum") { tblcd = "hsn"; }
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = errorData.b2b;
                                } else {
                                    tbldata = errorData.b2ba;
                                }
                                logger.log("info", "Entering Offline File:: updateerrdata with b2b");

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};

                                        subarray = tbldata[index].inv;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }
                                        if (subArrayFound.length == 1) {



                                            tbldata.splice(index, 1);

                                            tbl_data[0]['error_msg'] = "M";
                                            delete tbl_data[0].inv[0]['error_msg']
                                            delete tbl_data[0].inv[0]['old_inum']
                                            delete tbl_data[0].inv[0]['error_cd']

                                            tbldata.splice(index, 0, tbl_data[i]);



                                        }
                                    }
                                }
                                break;
                            case "doc_issue":
                                tbldata = errorData.doc_issue;
                                var tblarray = tbldata.doc_det;

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tblarray.myFind({
                                        'doc_num': invdltArray[0].doc_num
                                    });

                                    if (arrayFound.length != 0) { // if doc_num already exists
                                        var docAry = {};
                                        docAry = arrayFound[0].docs;
                                        for (var inputRow = 0; inputRow < invdltArray[0].docs.length; inputRow++) {
                                            var subArrayFound = docAry.myFind({
                                                'num': invdltArray[0].docs[inputRow].num
                                            });

                                            if (subArrayFound.length != 0) {

                                                var subIndex = docAry.indexOf(subArrayFound[0]);
                                                docAry.splice(subIndex, 1);
                                                docAry.splice(subIndex, 0, invdltArray[0].docs[inputRow])

                                            }
                                            else {
                                                docAry.push(invdltArray[0].docs[inputRow]);
                                            }

                                        }

                                    }
                                    else //if doc_num does not exist
                                    {

                                        tblarray.push(invdltArray[i]);
                                    }



                                }

                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    tbldata = errorData.b2cl;
                                } else {
                                    tbldata = errorData.b2cla;
                                }

                                logger.log("info", "Entering Offline File:: updateerrdata with b2cl");


                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;
                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }

                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);



                                            tbl_data[0]['error_msg'] = "M";
                                            delete tbl_data[0]['error_cd'];
                                            delete tbl_data[0]['old_inum'];
                                            tbldata.splice(index, 0, tbl_data[i]);

                                        }
                                    }
                                }


                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    tbldata = errorData.b2cs;
                                } else {
                                    tbldata = errorData.b2csa;
                                }
                                var compArr = [];
                                var count = 0, ukey;
                                for (var k = 0; k < tbldata.length; k++) {
                                    if (tblcd == "b2cs") {
                                        ukey = tbldata[k].pos + "_" + tbldata[k].rt + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }
                                    else {
                                        ukey = tbldata[k].omon + "_" + tbldata[k].pos + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }
                                    compArr.push(ukey);

                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var j = 0; j < compArr.length; j++) {

                                        if (compArr[j] === invdltArray[i].uni_key) {



                                            tbl_data = tbl_data.filter(function (props) {
                                                delete props.uni_key;
                                                return true;
                                            });

                                            tbldata.splice(j, 1);
                                            tbl_data[0]['error_msg'] = "M";
                                            delete tbl_data[0]['error_cd'];
                                            delete tbl_data[0]['ukey'];
                                            tbldata.splice(j, 0, tbl_data[0]);
                                        }

                                    }

                                }
                                break;
                            case "cdnr":
                            case "cdnra":
                                if (tblcd == "cdnr") {
                                    tbldata = errorData.cdnr || errorData.cdn;
                                } else {
                                    tbldata = errorData.cdnra;
                                }



                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};

                                        subarray = tbldata[index].nt;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].old_ntnum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                        }
                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);



                                            tbl_data[0]['error_msg'] = "M";
                                            delete tbl_data[0]['error_cd'];
                                            delete tbl_data[0]['old_ntnum'];
                                            tbldata.splice(index, 0, tbl_data[i]);

                                        }
                                    }
                                }
                                break;
                            case "cdnur":
                            case "cdnura":

                                if (tblcd == "cdnur") {
                                    tbldata = errorData.cdnur;
                                } else {
                                    tbldata = errorData.cdnura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {


                                    if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].old_ntnum
                                        });
                                    } else {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].nt_num
                                        });
                                    }
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);



                                        tbl_data[0]['error_msg'] = "M";
                                        delete tbl_data[0]['error_cd'];
                                        delete tbl_data[0]['old_ntnum'];
                                        tbldata.splice(index, 0, tbl_data[i]);

                                    }
                                }
                                break;
                            case "nil":
                                tbldata = errorData.nil;
                                tbldata.inv = []; // empty the array to update
                                for (var p = 0; p < tbl_data.length; p++) {

                                    tbldata.inv.push(tbl_data[p]);
                                }
                                break;
                            case "nil_supplies":
                                tbldata = errorData.nil_supplies;
                                tbl_data[0].error_msg = 'M';
                                delete tbl_data[0]['error_cd']
                                tbldata.splice(0, 1, tbl_data[0]);


                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = errorData.exp;
                                } else {
                                    tbldata = errorData.expa;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;

                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }

                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);



                                            tbl_data[0]['error_msg'] = "M";
                                            delete tbl_data[0]['error_cd'];
                                            delete tbl_data[0]['old_inum'];
                                            tbldata.splice(index, 0, tbl_data[i]);

                                        }
                                    }
                                }
                                break;
                            case "at":
                            //case "ata":
                            case "txi":
                            case "atxi":
                                if (tblcd == "at") {
                                    tbldata = errorData.at;
                                } else if (tblcd == "ata") {
                                    tbldata = errorData.ata;
                                } else if (tblcd == "txi") {
                                    tbldata = errorData.txi;
                                } else if (tblcd == "atxi") {
                                    tbldata = errorData.atxi;
                                }
                                if (form == 'GSTR1') {
                                    for (var j = 0; j < tbldata.length; j++) {

                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null
                                    }
                                    if (!invdltArray[0].diff_percent) {
                                        invdltArray[0].diff_percent = null
                                    }
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (invdltArray[i].old_pos && invdltArray[i].pos != '') {
                                        var tmp_pos = invdltArray[i].old_pos;
                                    } else {
                                        var tmp_pos = invdltArray[i].pos;
                                    }
                                    var arrayFound;

                                    if (form == "GSTR1") {
                                        arrayFound = tbldata.myFind({
                                            'pos': tmp_pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': tmp_pos
                                        });
                                    }
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing pos only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1); //delete row first with matched doc_num
                                        tbl_data[0]['error_msg'] = "M";
                                        delete tbl_data[0]['error_cd'];
                                        delete tbl_data[0]['old_pos'];
                                        tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                    }
                                }
                                break;
                            case "ata":

                                tbldata = errorData.atxi;
                                if (!tbldata) {
                                    tbldata = errorData.ata;
                                }

                                if (form == 'GSTR1') {
                                    for (var j = 0; j < tbldata.length; j++) {

                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null
                                    }
                                    if (!invdltArray[0].diff_percent) {
                                        invdltArray[0].diff_percent = null
                                    }
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (invdltArray[i].old_pos && invdltArray[i].pos != '') {
                                        var tmp_pos = invdltArray[i].old_pos;
                                    } else {
                                        var tmp_pos = invdltArray[i].pos;
                                    }
                                    if (invdltArray[i].old_omon && invdltArray[i].omon != '') {
                                        var tmp_omon = invdltArray[i].old_omon;
                                    } else {
                                        var tmp_omon = invdltArray[i].omon;
                                    }
                                    var arrayFound;

                                    if (form == "GSTR1") {
                                        arrayFound = tbldata.myFind({
                                            'pos': tmp_pos,
                                            'omon': tmp_omon,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': tmp_pos,
                                            'omon': tmp_omon
                                        });
                                    }

                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing pos only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1); //delete row first with matched doc_num
                                        tbl_data[0]['error_msg'] = "M";
                                        delete tbl_data[0]['error_cd'];
                                        delete tbl_data[0]['old_omon'];
                                        delete tbl_data[0]['old_pos'];
                                        tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                    }
                                }
                                break;
                            case "atadj":
                                tbldata = errorData.txpd;
                                if (form == 'GSTR1') {
                                    for (var j = 0; j < tbldata.length; j++) {

                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null
                                    }
                                    if (!invdltArray[0].diff_percent) {
                                        invdltArray[0].diff_percent = null
                                    }
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (invdltArray[i].old_pos && invdltArray[i].pos != '') {
                                        var tmp_pos = invdltArray[i].old_pos;
                                    } else {
                                        var tmp_pos = invdltArray[i].pos;
                                    }
                                    var arrayFound;

                                    if (form == "GSTR1") {
                                        arrayFound = tbldata.myFind({
                                            'pos': tmp_pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos

                                        });
                                    }

                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                    {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1); //delete row first with matched cpty
                                        tbl_data[0]['error_msg'] = "M";
                                        delete tbl_data[0]['error_cd']
                                        tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                    }
                                }
                                break;
                            case "atadja":

                                tbldata = errorData.txpda;

                                if (form == "GSTR1") {

                                    for (var j = 0; j < tbldata.length; j++) {

                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null
                                    }
                                    if (!invdltArray[0].diff_percent) {
                                        invdltArray[0].diff_percent = null
                                    }

                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (invdltArray[i].old_pos && invdltArray[i].pos != '') {
                                            var tmp_pos = invdltArray[i].old_pos;
                                        } else {
                                            var tmp_pos = invdltArray[i].pos;
                                        }
                                        if (invdltArray[i].old_omon && invdltArray[i].omon != '') {
                                            var tmp_omon = invdltArray[i].old_omon;
                                        } else {
                                            var tmp_omon = invdltArray[i].omon;
                                        }

                                        var arrayFound = tbldata.myFind({
                                            'pos': tmp_pos,
                                            'omon': tmp_omon,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });


                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty
                                            tbl_data[0]['error_msg'] = "M";
                                            delete tbl_data[0]['error_cd'];
                                            delete tbl_data[0]['old_omon'];
                                            delete tbl_data[0]['old_pos'];
                                            tbldata.splice(index, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                        }
                                    }
                                } else { //for  GSTR2
                                    //ergtergter
                                    tbldata = gstfile.atadj;
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty
                                            tbldata.splice(index, 0, tbl_data[j]); //insert updated row in the same index of previous row
                                        } else {
                                            logger.log("error", "Invoice  does not exist");
                                        }
                                    }

                                }
                                break;
                            case "hsn":
                                tbldata = errorData.hsn ? errorData.hsn : errorData.hsnsum;
                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, month)) {
                                        tbldata.forEach(function (row, outerIndex) {
                                            row.data.forEach(function (data, innerIndex) {
                                                if (data.num == invdltArray[0].num) {
                                                    tbldata[outerIndex].data[innerIndex] = tbl_data[0].data[0];
                                                }
                                            });
                                        });
                                    }
                                    else {

                                        var arrayFound = tbldata[0].data.myFind({
                                            'num': invdltArray[i].num
                                        });

                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing num only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata[0].data.indexOf(arrayFound[0]);
                                            tbldata[0].data.splice(index, 1);
                                            tbl_data[0].data[0]['error_msg'] = "M";
                                            delete tbl_data[0].data[0]['error_cd']
                                            tbldata[0].data.splice(index, 0, tbl_data[0].data[0]);


                                        }
                                    }
                                }
                                break;

                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = errorData.b2bur;
                                } else {
                                    tbldata = errorData.b2bura;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};

                                        subarray = tbldata[index].inv;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }
                                        if (subArrayFound.length == 1) {
                                            var index = tbldata[0].inv.indexOf(subArrayFound[0]);


                                            tbldata[index].inv.splice(index, 1);
                                            delete tbl_data[i].inv[0]['error_msg'];
                                            delete tbl_data[i].inv[0]['error_cd'];
                                            delete tbl_data[i].inv[0]['old_inum'];
                                            tbldata[index]['error_msg'] = "M";

                                            tbldata[0].inv.splice(index, 0, tbl_data[i].inv[0]);



                                        }
                                    }
                                }
                                break;
                            case "imp_g":
                            case "imp_ga":
                                if (tblcd == "imp_g") {
                                    tbldata = errorData.imp_g;
                                } else {
                                    tbldata = errorData.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        delete tbl_data[i].error_cd;
                                        tbl_data[i]['error_msg'] = "M";
                                        tbldata.splice(index, 1, tbl_data[i]);
                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = errorData.imp_s;

                                } else {
                                    tbldata = errorData.imp_sa;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        delete tbl_data[i].error_cd;
                                        tbl_data[i]['error_msg'] = "M";
                                        tbldata.splice(index, 1, tbl_data[i]);
                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = errorData.hsnsum;


                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata[0].det.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) //no other case is possible.because update will be called for existing num only.So array found will always have a value of 1.
                                    {

                                        var index = tbldata[0].det.indexOf(arrayFound[0]);
                                        tbldata[0].det.splice(index, 1);
                                        tbl_data[0].det[0]['error_msg'] = "M";
                                        delete tbl_data[0].det[0]['error_cd']
                                        tbldata[0].det.splice(index, 0, tbl_data[0].det[i]);

                                    }
                                }
                                break;
                            case "itc_rvsl": //for  GSTR2
                                tbldata = errorData.itc_rvsl;
                                tbl_data[0]['error_msg'] = 'M';
                                delete tbl_data[0]['error_cd']
                                tbldata.splice(0, 1, tbl_data[0]);
                                break;
                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        if (type == "Upload") {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document updated successfully")
                        } else {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document updated successfully")

                        }
                    }
                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While updating the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return document updated successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};
var updateaccepteddata = function (req, res) {
    logger.log("info", "Entering Offline File:: updateaccepteddata ");
    var errorObject = null;
    try {
        var gstin = req.body.gstin;
        var form = req.body.form;
        var fy = req.body.fy;
        var month = req.body.month;
        var tblcd = req.body.tbl_cd;
        var tbl_data = req.body.tbl_data;
        var dir;
        logger.log("info", "Entering Offline File:: updatetbldata with tbl_data :: %s", tbl_data);
        logger.log("info", "Entering Offline File:: updatetbldata with tblcd :: %s", tblcd);
        var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of ctin and respective invoice no. to update
        var type = req.body.type;

        var filename;

        if (req.body.returnFileName)
            filename = __dirname + '/../public/' + req.body.returnFileName;
        else {
            dir = uploadedFiledir + gstin + "_" + form + "_" + fy + "_" + month;
            filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';
        }
        async.waterfall([
            function (callback) {
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {

                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(null, tbl_data)
                    } else {
                        var gstfile = JSON.parse(data);
                        //logger.log("info", " gstfile:: %s", gstfile);
                        var tbldata;
                        if (typeof gstfile.backups === 'undefined') {
                            gstfile.backups = {
                                b2b: {},
                                cdnr: {},
                                b2ba: {},
                                cdnra: {}
                            };
                        }
                        var backups = gstfile.backups;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":

                                tbldata = gstfile[tblcd];
                                var isdataModified = "No";
                                var abort = false;
                                var change_was_found = false;
                                var ITCchange_was_found = false;
                                if (form == 'GSTR1') {


                                    for (var i = 0; i < invdltArray.length; i++) {

                                        var arrayFound = tbldata.myFind({
                                            'ctin': invdltArray[i].ctin
                                        });
                                        if (arrayFound.length <= 1) {
                                            var subarray = {};
                                            subarray = arrayFound[0].inv

                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum,
                                                'chksum': invdltArray[i].chksum
                                            });

                                            var subIndex = subarray.indexOf(subArrayFound[0]);

                                            if ((tbl_data[i].inv[0].flag == 'M' || tbl_data[i].inv[0].flag == 'N') && typeof backups[tblcd][invdltArray[i].inum] === 'undefined') {

                                                if (
                                                    tbl_data[0].inv[0].idt == subarray[subIndex].idt && tbl_data[0].inv[0].val == subarray[subIndex].val && tbl_data[0].inv[0].rchrg == subarray[subIndex].rchrg && tbl_data[0].inv[0].pos == subarray[subIndex].pos && tbl_data[0].inv[0].inv_typ == subarray[subIndex].inv_typ) {
                                                    // main level is same
                                                    if (subarray[subIndex].itms.length == tbl_data[0].inv[0].itms.length) {

                                                        for (var k = 0; k < subarray[subIndex].itms.length; k++) {
                                                            if (
                                                                _.isEmpty(
                                                                    common.diffObject(
                                                                        subarray[subIndex].itms[k].itm_det, tbl_data[0].inv[0].itms[k].itm_det
                                                                    )
                                                                )
                                                            ) {

                                                                if (
                                                                    _.isEmpty(
                                                                        common.diffObject(
                                                                            subarray[subIndex].itms[k].itc, tbl_data[0].inv[0].itms[k].itc
                                                                        )
                                                                    )
                                                                ) {
                                                                    // no change found

                                                                } else {
                                                                    ITCchange_was_found = true;
                                                                }
                                                            } else {
                                                                change_was_found = true;
                                                                //data is changed, let the flag be M only

                                                            }
                                                        }
                                                    } else {
                                                        // a new item has been added, change was found
                                                        change_was_found = true;
                                                    }
                                                    // AFTER ITEM LEVEL LOOP
                                                    if (change_was_found) {
                                                        tbl_data[i].inv[0].flag = 'M'
                                                    } else {
                                                        if (ITCchange_was_found) {
                                                            tbl_data[i].inv[0].flag = 'A'
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                } else {
                                                    tbl_data[i].inv[0].flag = 'M'
                                                }

                                                if (backups[tblcd][invdltArray[i].inum] === undefined)
                                                    backups[tblcd][invdltArray[i].inum] = subarray[subIndex];




                                            }
                                            var tt = subarray.splice(subIndex, 1); //delete row first with matched inum


                                            if (tbl_data[i].inv[0].flag == "R") {
                                                if (typeof backups[tblcd][invdltArray[i].inum] !== 'undefined')
                                                    tbl_data[i].inv[0] = backups[tblcd][invdltArray[i].inum];
                                                tbl_data[i].inv[0].flag = 'R';
                                            }
                                            var arrayFound = tbldata.myFind({
                                                'ctin': invdltArray[i].ctin
                                            });
                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, tbl_data[i]);
                                            } else {
                                                var subarray = {};
                                                subarray = arrayFound[0].inv;
                                                subarray.splice(subIndex, 0, tbl_data[i].inv[0]); //insert updated row in the same index of previous row
                                                common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);
                                            }
                                        }

                                    }

                                } else {
                                    for (var i = 0; i < invdltArray.length; i++) {

                                        var arrayFound = tbldata.myFind({
                                            'ctin': invdltArray[i].ctin
                                        });
                                        if (arrayFound.length <= 1) {
                                            var subarray = {};
                                            subarray = arrayFound[0].inv;
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });

                                            var subIndex = subarray.indexOf(subArrayFound[0]);
                                            if (typeof tbl_data[i].inv !== 'undefined' && typeof tbl_data[i].inv[0] !== 'undefined') {
                                                tbl_data[i] = tbl_data[i].inv[0]
                                            }

                                            if (
                                                (
                                                    tbl_data[i].flag == 'M' ||
                                                    tbl_data[i].flag == 'N') &&
                                                typeof backups[tblcd][invdltArray[i].inum] === 'undefined'
                                            ) {

                                                if (
                                                    tbl_data[i].idt == subarray[subIndex].idt && tbl_data[i].val == subarray[subIndex].val && tbl_data[i].rchrg == subarray[subIndex].rchrg) {
                                                    // main level is same

                                                    if (subarray[subIndex].itms.length == tbl_data[i].itms.length) {

                                                        for (var k = 0; k < subarray[subIndex].itms.length; k++) {
                                                            if (
                                                                _.isEmpty(
                                                                    common.diffObject(
                                                                        subarray[subIndex].itms[k].itm_det, tbl_data[i].itms[k].itm_det
                                                                    )
                                                                )
                                                            ) {

                                                                if (
                                                                    _.isEmpty(
                                                                        common.diffObject(
                                                                            subarray[subIndex].itms[k].itc, tbl_data[i].itms[k].itc
                                                                        )
                                                                    )
                                                                ) {
                                                                    // no change found

                                                                } else {
                                                                    ITCchange_was_found = true;
                                                                }
                                                            } else {
                                                                change_was_found = true;
                                                                //data is changed, let the flag be M only

                                                            }
                                                        }
                                                    } else {
                                                        change_was_found = true;
                                                    }
                                                    // AFTER ITEM LEVEL LOOP
                                                    if (change_was_found) {
                                                        tbl_data[i].flag = 'M'

                                                    } else {
                                                        if (ITCchange_was_found) {

                                                            tbl_data[i].flag = 'A'
                                                        } else {

                                                            break;
                                                        }
                                                    }
                                                } else {

                                                    tbl_data[i].flag = 'M'
                                                }


                                                if (backups[tblcd][invdltArray[i].inum] === undefined)
                                                    backups[tblcd][invdltArray[i].inum] = subarray[subIndex];




                                            }

                                            var tt = subarray.splice(subIndex, 1); //delete row first with matched inum


                                            if (tbl_data[i].flag == "R") {
                                                if (typeof backups[tblcd][invdltArray[i].inum] !== 'undefined')
                                                    tbl_data[i] = backups[tblcd][invdltArray[i].inum];
                                                tbl_data[i].flag = 'R';
                                            }
                                            if (tbl_data[i].flag == "P") {
                                                if (typeof backups[tblcd][invdltArray[i].inum] !== 'undefined')
                                                    tbl_data[i] = backups[tblcd][invdltArray[i].inum];
                                                tbl_data[i].flag = 'P';
                                            }



                                            var arrayFound = tbldata.myFind({
                                                'ctin': invdltArray[i].ctin
                                            });
                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, [{
                                                    ctin: tbl_data[i].ctin,
                                                    inv: [tbl_data[i]]
                                                }]);
                                            } else {
                                                var subarray = {};
                                                subarray = arrayFound[0].inv;
                                                subarray.splice(subIndex, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                                common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);



                                            }

                                        }

                                    }
                                }

                                gstfile[tblcd] = tbldata;
                                gstfile.backups = backups;

                                callback(null, gstfile)
                                break;

                            case "cdnr":
                            case "cdnra":
                                if (typeof gstfile[tblcd] == 'undefined') {
                                    tblcd = "cdn";
                                    tbldata = gstfile[tblcd];
                                } else {
                                    tbldata = gstfile[tblcd];
                                }
                                var isdataModified = "No";
                                var abort = false;
                                var change_was_found = false;
                                var ITCchange_was_found = false;

                                if (form == 'GSTR1') {

                                    for (var i = 0; i < invdltArray.length; i++) {
                                        var arrayFound = tbldata.myFind({
                                            'ctin': invdltArray[i].ctin
                                        });
                                        if (arrayFound.length <= 1) {

                                            var index = tbldata.indexOf(arrayFound[0]); // to find the index of the object

                                            var subarray = {};
                                            subarray = arrayFound[0].nt;
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num,
                                                'chksum': invdltArray[i].chksum
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);


                                            if ((tbl_data[i].nt[0].flag == 'M' || tbl_data[i].nt[0].flag == 'N') && typeof backups[tblcd][invdltArray[i].nt_num] === 'undefined') {

                                                if (

                                                    tbl_data[0].nt[0].ntty == subarray[subIndex].ntty &&
                                                    tbl_data[0].nt[0].nt_num == subarray[subIndex].nt_num &&
                                                    tbl_data[0].nt[0].nt_dt == subarray[subIndex].nt_dt &&
                                                    tbl_data[0].nt[0].idt == subarray[subIndex].idt &&
                                                    tbl_data[0].nt[0].val == subarray[subIndex].val &&
                                                    tbl_data[0].nt[0].p_gst == subarray[subIndex].p_gst) {
                                                    if (subarray[subIndex].itms.length == tbl_data[0].nt[0].itms.length) {

                                                        for (var k = 0; k < subarray[subIndex].itms.length; k++) {
                                                            if (
                                                                _.isEmpty(
                                                                    common.diffObject(
                                                                        subarray[subIndex].itms[k].itm_det, tbl_data[0].nt[0].itms[k].itm_det
                                                                    )
                                                                )
                                                            ) {

                                                                if (
                                                                    _.isEmpty(
                                                                        common.diffObject(
                                                                            subarray[subIndex].itms[k].itc, tbl_data[0].nt[0].itms[k].itc
                                                                        )
                                                                    )
                                                                ) {
                                                                    // no change found

                                                                } else {
                                                                    ITCchange_was_found = true;

                                                                }
                                                            } else {
                                                                change_was_found = true;
                                                                //data is changed, let the flag be M only

                                                            }
                                                        }
                                                    } else {
                                                        change_was_found = true;
                                                    }
                                                    // AFTER ITEM LEVEL LOOP
                                                    if (change_was_found) {
                                                        tbl_data[i].nt[0].flag = 'M'

                                                    } else {
                                                        if (ITCchange_was_found) {

                                                            tbl_data[i].nt[0].flag = 'A'
                                                        } else {

                                                            break;
                                                        }
                                                    }
                                                } else {
                                                    tbl_data[i].nt[0].flag = 'M'
                                                }

                                                if (backups[tblcd][invdltArray[i].nt_num] === undefined)
                                                    backups[tblcd][invdltArray[i].nt_num] = subarray[subIndex];
                                            }

                                            var tt = subarray.splice(subIndex, 1); //delete row first with
                                            if (tbl_data[i].nt[0].flag == "R") {
                                                if (typeof backups[tblcd][invdltArray[i].nt_num] !== 'undefined')
                                                    tbl_data[i].nt[0] = backups[tblcd][invdltArray[i].nt_num];
                                                tbl_data[i].nt[0].flag = 'R';
                                            }


                                            var arrayFound = tbldata.myFind({
                                                'ctin': invdltArray[i].ctin
                                            });

                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, tbl_data[i]);
                                            } else {
                                                var subarray = {};
                                                subarray = arrayFound[0].nt;
                                                subarray.splice(subIndex, 0, tbl_data[i].nt[0]); //insert updated row in the same index of previous row

                                                common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);



                                            }


                                            //}
                                        }

                                    }



                                } else {
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        var arrayFound = tbldata.myFind({
                                            'ctin': invdltArray[i].ctin
                                        });
                                        if (arrayFound.length <= 1) {

                                            var subarray = {};
                                            subarray = arrayFound[0].nt;
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                            var subIndex = subarray.indexOf(subArrayFound[0]);

                                            if (typeof tbl_data[i].nt !== 'undefined' && typeof tbl_data[i].nt[0] !== 'undefined') {
                                                tbl_data[i] = tbl_data[i].nt[0]
                                            }

                                            if ((tbl_data[i].flag == 'M' || tbl_data[i].flag == 'N') && typeof backups[tblcd][invdltArray[i].nt_num] === 'undefined') {


                                                if (

                                                    tbl_data[i].ntty == subarray[subIndex].ntty &&
                                                    tbl_data[i].nt_num == subarray[subIndex].nt_num &&
                                                    tbl_data[i].nt_dt == subarray[subIndex].nt_dt &&
                                                    tbl_data[i].idt == subarray[subIndex].idt &&
                                                    tbl_data[i].val == subarray[subIndex].val) {
                                                    if (subarray[subIndex].itms.length == tbl_data[i].itms.length) {

                                                        for (var k = 0; k < subarray[subIndex].itms.length; k++) {


                                                            if (
                                                                _.isEmpty(
                                                                    common.diffObject(
                                                                        subarray[subIndex].itms[k].itm_det, tbl_data[i].itms[k].itm_det
                                                                    )
                                                                )
                                                            ) {

                                                                if (
                                                                    _.isEmpty(
                                                                        common.diffObject(
                                                                            subarray[subIndex].itms[k].itc, tbl_data[i].itms[k].itc
                                                                        )
                                                                    )
                                                                ) {
                                                                    // no change found

                                                                } else {
                                                                    ITCchange_was_found = true;

                                                                }
                                                            } else {
                                                                change_was_found = true;
                                                                //data is changed, let the flag be M only

                                                            }
                                                        }
                                                    } else {
                                                        change_was_found = true;
                                                    }
                                                    // AFTER ITEM LEVEL LOOP
                                                    if (change_was_found) {
                                                        tbl_data[i].flag = 'M'

                                                    } else {
                                                        if (ITCchange_was_found) {

                                                            tbl_data[i].flag = 'A'
                                                        } else {

                                                            break;
                                                        }
                                                    }
                                                } else {

                                                    tbl_data[i].flag = 'M'
                                                }

                                                if (backups[tblcd][invdltArray[i].nt_num] === undefined)
                                                    backups[tblcd][invdltArray[i].nt_num] = subarray[subIndex];
                                            }


                                            var tt = subarray.splice(subIndex, 1); //delete row first with
                                            if (tbl_data[i].flag == "R") {
                                                if (typeof backups[tblcd][invdltArray[i].nt_num] !== 'undefined')
                                                    tbl_data[i] = backups[tblcd][invdltArray[i].nt_num];
                                                tbl_data[i].flag = 'R';
                                            }
                                            if (tbl_data[i].flag == "P") {
                                                if (typeof backups[tblcd][invdltArray[i].nt_num] !== 'undefined')
                                                    tbl_data[i] = backups[tblcd][invdltArray[i].nt_num];
                                                tbl_data[i].flag = 'P';
                                            }

                                            if (arrayFound.length == 0) {
                                                tbldata.splice(subIndex, 0, tbl_data[i]);
                                            } else {

                                                subarray.splice(subIndex, 0, tbl_data[i]); //insert updated row in the same index of previous row
                                                common.findAndReplace(tbldata, tbl_data[i].ctin, subarray, tblcd);
                                            }
                                        }

                                    }
                                }






                                if (typeof gstfile[tblcd] === 'undefined') {
                                    gstfile.cdn = tbldata;
                                } else {
                                    gstfile[tblcd] = tbldata;
                                }
                                gstfile.backups = backups;

                                callback(null, gstfile)



                                break;
                            default:
                                logger.log("error", "This functionality is only for b2b and cdnr section and getting ::%s", tblcd);
                        }
                    }

                })
            },
            function (gstfile, callback) {
                if (type == "Upload") {
                    fs.writeFileSync(filename, JSON.stringify(gstfile));

                    callback(null, "Document updated successfully")
                } else {
                    fs.writeFileSync(filename, JSON.stringify(gstfile));

                    callback(null, "Document updated successfully")

                }


            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                logger.log("error", "err :: %s", err);
                if (err == "200OK") {
                    logger.log("error", "User cannot modify the rejected invoices :: %s", err);
                    response.success("You cannot modify the invoice if you are rejecting the invoice", res)
                } else {
                    errorObject = {
                        statusCd: 400,
                        errorCd: 400,
                    };
                    logger.log("error", "Error While updating the documents :: %s", errorObject);
                    console.log(err)
                    response.error(errorObject, res);
                }

            } else {
                logger.log("info", "Document updated successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};


var addmltpldata = function (req, res) {
    var myCache = req.app.get('myCache');
    logger.log("info", "Entering Offline File:: addmltpldata ");
    var errorObject = null;
    try {
        var gstin = req.body.gstin;
        var form = req.body.form;
        var gt = req.body.gt;
        var cur_gt = req.body.cur_gt;
        var fp = req.body.fp;
        var fy = req.body.fy;
        var month = req.body.month;
        var dataObj = req.body.tbl_data;
        var jsonObj = [];
        var crclm_17_3 = req.body.crclm_17_3;
        var type = req.body.type;
        var dir, isSameGSTIN, filename;
        var impfileName = req.body.returnFileName;
        async.waterfall([
            function (callback) {
                logger.log("info", "entered in async.waterfall function 0, cehcking for data-cache");
                if (dataObj.cache_key != undefined) {
                    myCache.get(dataObj.cache_key, function (err, value) {
                        if (!err) {
                            if (value == undefined) {
                                logger.log("warning", "cache key found, but not the data, something wrong, abort");
                                callback('uanble to fetch key', null);
                            } else {
                                dataObj = value; // no need to pass dataObj, its in function scope.
                                callback(null)
                            }
                        } else {
                            logger.log("warning", "cache key found, but unable to get the data, something wrong, abort");
                            callback(err, null)
                        }
                    });

                } else {
                    // cache key not found in payload, proceed with normal payload.
                    callback(null)
                }
            },
            function (callback) {
                logger.log("info", "entered in async.waterfall function 1");
                common.formDataFormat(req, function (formDataFormat) {
                    logger.log("info", "entered in async.waterfall formDataFormat");

                    callback(null, formDataFormat)
                })
            },

            function (formDataFormat, callback) {

                if (type == "Import") {
                    dir = uploadedImpFiledir;
                    filename = dir + "/" + impfileName.replace("./download", "");

                } else {
                    dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month;
                    filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json';
                }

                if (!fs.existsSync(dir)) // when user will come first time and no directory is there to save the file.
                // user will enter only once in this.
                //After entering  file will get created.
                {
                    mkdirp(dir, function (err) // if directory is not there will create directory
                    {
                        if (err) // if we are facing issue in creating the directory
                        {
                            logger.log("error", "Unexpected error while creating the directory:: %s", err.message);
                            callback(err, null)
                        } else // if we are not facing issue in creating the directory.
                        {
                            fs.writeFile(filename, formDataFormat, function (err) // after creating the directory we are creating file inside that in order to save the table data.
                            {
                                if (err) // if we are facing issue in creating the file
                                {
                                    logger.log("error", "Unexpected error while creating the file:: %s", err.message);
                                    callback(err, null);
                                } else // file is created
                                {

                                    fs.readFile(filename, 'utf8', function (err, data) {
                                        if (err) //if we are unable to read the file
                                        {
                                            logger.log("error", "Unexpected error while reading the file:: %s", err.message);
                                            callback(err, null)

                                        } else // if we are able to read the file
                                        {
                                            var gstfile = JSON.parse(data);

                                            var tbldata;
                                            var jsonObj = [];
                                            /* push data according to table no.*/
                                            for (var k = 0; k < dataObj.length; k++) {

                                                var secData = dataObj[k];
                                                if (!secData.dt[0]) {

                                                    logger.log("info", "data is not there so no need to add empty array");
                                                } else {
                                                    logger.log("info", "data is there");
                                                    switch (secData.cd) {
                                                        case "b2b":
                                                        case "b2ba":
                                                            if (secData.cd == "b2b") {
                                                                tbldata = gstfile.b2b;

                                                            } else {
                                                                tbldata = gstfile.b2ba;


                                                            }

                                                            for (var p = 0; p < secData.dt.length; p++) {
                                                                if (gstin == secData.dt[p].ctin || gstin == secData.dt[p].inv[0].etin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    var arrayFound = tbldata.myFind({
                                                                        'ctin': secData.dt[p].ctin
                                                                    });
                                                                    var status = secData.dt[p].inv[0].status;
                                                                    if (status) {
                                                                        secData.dt[p].inv[0].status = undefined;
                                                                    }

                                                                    if ((status && status != 'Cancelled') || !status) {
                                                                        if (arrayFound.length == 0) {
                                                                            tbldata.push(secData.dt[p]);
                                                                        } else {
                                                                            var subarray = {};
                                                                            subarray = arrayFound[0].inv;
                                                                            subarray.push(secData.dt[p].inv[0]);
                                                                            common.findAndReplace(tbldata, secData.dt[p].ctin, subarray, secData.cd);
                                                                        }

                                                                    }

                                                                }
                                                            }


                                                            break;
                                                        case "doc_issue":
                                                            tbldata = gstfile.doc_issue;
                                                            if (tbldata['flag']) {
                                                                delete tbldata['flag'];
                                                            }
                                                            var uniKeyAry = [];  // array to store unique key property
                                                            var keyObj = {};

                                                            var tblarray = tbldata.doc_det;

                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                keyObj.doc_num = secData.dt[i].doc_num;


                                                                uniKeyAry.push(keyObj);


                                                                var arrayFound = tblarray.myFind({
                                                                    'doc_num': uniKeyAry[0].doc_num
                                                                });

                                                                if (arrayFound.length != 0) { // if doc_num already exists

                                                                    var docAry = {};
                                                                    docAry = arrayFound[0].docs;
                                                                    for (var inputRow = 0; inputRow < secData.dt[i].docs.length; inputRow++) {
                                                                        var subArrayFound = docAry.myFind({
                                                                            'num': secData.dt[i].docs[inputRow].num
                                                                        });

                                                                        if (subArrayFound.length != 0) {

                                                                            var subIndex = docAry.indexOf(subArrayFound[0]);
                                                                            docAry.splice(subIndex, 1);
                                                                            docAry.splice(subIndex, 0, secData.dt[i].docs[inputRow])
                                                                        }
                                                                        else {
                                                                            docAry.push(secData.dt[i].docs[inputRow]);
                                                                        }

                                                                    }

                                                                }
                                                                else //if doc_num does not exist
                                                                {

                                                                    tblarray.push(secData.dt[i]);
                                                                }



                                                            }
                                                            break;
                                                        case "b2cl":
                                                        case "b2cla":
                                                            if (secData.cd == "b2cl") {
                                                                tbldata = gstfile.b2cl;

                                                            } else {
                                                                tbldata = gstfile.b2cla;

                                                            }
                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                if (gstin == secData.dt[i].inv[0].etin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    var arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos
                                                                    });
                                                                    if (arrayFound.length == 0) {
                                                                        tbldata.push(secData.dt[i]);
                                                                    } else {
                                                                        var subarray = {};
                                                                        subarray = arrayFound[0].inv;
                                                                        subarray.push(secData.dt[i].inv[0]);
                                                                        common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                    }
                                                                }

                                                            }
                                                            break;
                                                        case "b2cs":
                                                            //case "b2csa":
                                                            if (secData.cd == "b2cs") {
                                                                tbldata = gstfile.b2cs;

                                                            }
                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                var count = 0;
                                                                if (gstin == secData.dt[i].etin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    for (var j = 0; j < tbldata.length; j++) {

                                                                        if (tbldata[j].pos === secData.dt[i].pos) {
                                                                            if (tbldata[j].rt === secData.dt[i].rt) {
                                                                                if (tbldata[j].etin === secData.dt[i].etin) {
                                                                                    if (tbldata[j].diff_percent === secData.dt[i].diff_percent) {
                                                                                        tbldata.splice(j, 1);
                                                                                        tbldata.splice(j, 0, secData.dt[i]);
                                                                                        count = 1;
                                                                                    }
                                                                                }

                                                                            }
                                                                        }
                                                                    }
                                                                    if (count != 1) {

                                                                        tbldata.push(secData.dt[i]);

                                                                    } else {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].pos + "_" + secData.dt[i].rt + "_" + secData.dt[i].typ);
                                                                    }
                                                                }

                                                            }
                                                            break;
                                                        case "b2csa":

                                                            tbldata = gstfile.b2csa;
                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {

                                                                if (!secData.dt[i].diff_percent)
                                                                    secData.dt[i].diff_percent = null;

                                                                var arrayFound = tbldata.myFind({
                                                                    'pos': secData.dt[i].pos,
                                                                    'omon': secData.dt[i].omon,
                                                                    'diff_percent': secData.dt[i].diff_percent
                                                                });
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0];
                                                                    subarray.push(secData.dt[i]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }
                                                            break;

                                                        case "cdnr":
                                                        case "cdnra":

                                                            if (secData.cd == "cdnr") {
                                                                tbldata = gstfile.cdnr;

                                                            } else {
                                                                tbldata = gstfile.cdnra;

                                                            }
                                                            for (var p = 0; p < secData.dt.length; p++) {
                                                                if (gstin == secData.dt[p].ctin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    var arrayFound = tbldata.myFind({
                                                                        'ctin': secData.dt[p].ctin
                                                                    });
                                                                    var status = secData.dt[p].nt[0].status;
                                                                    if (status) {
                                                                        secData.dt[p].nt[0].status = undefined;
                                                                    }

                                                                    if ((status && status != 'Cancelled') || !status) {
                                                                        if (arrayFound.length == 0) {

                                                                            tbldata.push(secData.dt[p]);
                                                                        } else {
                                                                            var subarray = {};
                                                                            subarray = arrayFound[0].nt;
                                                                            subarray.push(secData.dt[p].nt[0]);
                                                                            common.findAndReplace(tbldata, secData.dt[p].ctin, subarray, secData.cd);
                                                                        }
                                                                    }


                                                                }
                                                            }


                                                            break;
                                                        case "cdnur":
                                                        case "cdnura":
                                                            if (secData.cd == 'cdnur') {
                                                                tbldata = gstfile.cdnur;
                                                            } else {
                                                                tbldata = gstfile.cdnura;
                                                            }


                                                            //  tbldata.push(secData.dt[0]);


                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                var arrayFound = tbldata.myFind({
                                                                    'nt_num': secData.dt[i].nt_num
                                                                });
                                                                var status = secData.dt[i].status;
                                                                if (status) {
                                                                    secData.dt[i].status = undefined;
                                                                }

                                                                if ((status && status != 'Cancelled') || !status) {
                                                                    if (arrayFound.length == 0) {

                                                                        tbldata.push(secData.dt[i]);
                                                                    } else {
                                                                        var subarray = {};
                                                                        subarray = arrayFound[0];
                                                                        subarray.push(secData.dt[i]);
                                                                        common.findAndReplace(tbldata, secData.dt[i].nt_num, subarray, secData.cd);
                                                                    }
                                                                }

                                                            }
                                                            break;

                                                        case "nil":
                                                            if (form == "GSTR2") {
                                                                logger.log("info", "entered in nilsupplies section");
                                                                tbldata = gstfile.nil_supplies;
                                                                tbldata = secData.dt[0];
                                                                gstfile.nil_supplies = tbldata;
                                                            } else {
                                                                tbldata = gstfile.nil;
                                                                for (var p = 0; p < secData.dt.length; p++) {
                                                                    tbldata.inv.push(secData.dt[p]);
                                                                }
                                                            }
                                                            break;
                                                        case "exp":
                                                        case "expa":
                                                            if (secData.cd == "exp") {
                                                                tbldata = gstfile.exp;

                                                            } else {
                                                                tbldata = gstfile.expa;

                                                            }

                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                var arrayFound = tbldata.myFind({
                                                                    'exp_typ': secData.dt[i].exp_typ
                                                                });
                                                                var status = secData.dt[i].inv[0].status;
                                                                if (status) {
                                                                    secData.dt[i].inv[0].status = undefined;
                                                                }

                                                                if ((status && status != 'Cancelled') || !status) {
                                                                    if (arrayFound.length == 0) {
                                                                        tbldata.push(secData.dt[i]);
                                                                    } else {
                                                                        var subarray = {};
                                                                        subarray = arrayFound[0].inv;
                                                                        subarray.push(secData.dt[i].inv[0]);
                                                                        common.findAndReplace(tbldata, secData.dt[i].exp_typ, subarray, secData.cd);
                                                                    }
                                                                }

                                                            }
                                                            break;
                                                        case "at":


                                                            tbldata = gstfile.at;

                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos
                                                                    });
                                                                }

                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0].itms;
                                                                    subarray.push(secData.dt[i].itms[0]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }

                                                            break;
                                                        case "ata":

                                                            tbldata = gstfile.ata;


                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {//since now diff_percent is also a key
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon
                                                                    });
                                                                }

                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0];
                                                                    subarray.push(secData.dt[i]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }

                                                            break;
                                                        case "atadj":


                                                            tbldata = gstfile.atadj;


                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos
                                                                    });
                                                                }
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0].itms;
                                                                    subarray.push(secData.dt[i].itms[0]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }
                                                            break;
                                                        case "atadja":

                                                            tbldata = gstfile.atadja;


                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {//since now diff_percent is also a key
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon
                                                                    });
                                                                }
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0];
                                                                    subarray.push(secData.dt[i]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }
                                                            break;
                                                        case "ecom_invocies":
                                                            gstfile['ecom_invocies'].push((secData.dt));
                                                            break;
                                                        case "hsn":
                                                            tbldata = gstfile.hsn;

                                                            if (tbldata['flag']) {
                                                                delete tbldata['flag'];
                                                            }
                                                            if (typeof tbldata.data == 'object') {
                                                                var total_hsn_objects = gstfile.hsn.data.length;
                                                            } else {
                                                                var total_hsn_objects = 0;
                                                            }
                                                            total_hsn_objects++; // num  should atleast be 1

                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                var count = 0;

                                                                for (var j = 0; j < tbldata.data.length; j++) {

                                                                    if (tbldata.data[j].hsn_sc === secData.dt[i].data[0].hsn_sc) {

                                                                        if (!tbldata.data[j].desc)
                                                                            tbldata.data[j].desc = '';


                                                                        if (!secData.dt[i].data[0].desc)
                                                                            secData.dt[i].data[0].desc = '';


                                                                        if ((tbldata.data[j].desc).toLowerCase() === (secData.dt[i].data[0].desc).toLowerCase()) {
                                                                            //todo
                                                                            if ((tbldata.data[j].uqc).toLowerCase() === (secData.dt[i].data[0].uqc).toLowerCase()) {
                                                                                if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, fp)) {
                                                                                    if (tbldata.data[j].rt == secData.dt[i].data[0].rt) {
                                                                                        secData.dt[i].data[0].num = tbldata.data[j].num;

                                                                                        tbldata.data.splice(j, 1);
                                                                                        tbldata.data.splice(j, 0, secData.dt[i].data[0]);
                                                                                        count = 1;
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    secData.dt[i].data[0].num = tbldata.data[j].num;

                                                                                    tbldata.data.splice(j, 1);
                                                                                    tbldata.data.splice(j, 0, secData.dt[i].data[0]);
                                                                                    count = 1;
                                                                                }
                                                                            }

                                                                        }

                                                                    }
                                                                }
                                                                if (count != 1) {

                                                                    var maxNum = 0;
                                                                    forEach(tbldata.data, function (data, index) {
                                                                        if (data.num >= maxNum) {
                                                                            maxNum = data.num + 1;
                                                                        }
                                                                    });

                                                                    secData.dt[i].data[0].num = ((total_hsn_objects >= maxNum) ? total_hsn_objects : maxNum);
                                                                    total_hsn_objects++;

                                                                    tbldata.data.push(secData.dt[i].data[0]);

                                                                } else {
                                                                    if (!secData.dt[i].data[0].hsn_sc) {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].data[0].desc);
                                                                    } else {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].data[0].hsn_sc);
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "b2bur": //for  R2
                                                        case "b2bura": //for R2
                                                            if (secData.cd == "b2bur") {
                                                                tbldata = gstfile.b2bur;

                                                            } else {
                                                                tbldata = gstfile.b2bura;

                                                            }
                                                            tbldata[0].inv.push(secData.dt[0].inv[0]);

                                                            for (var i = 1; i < secData.dt.length; i++) {

                                                                var arrayFound = tbldata[0].inv;

                                                                var subarrayFound = arrayFound.myFind({
                                                                    'inum': secData.dt[i].inv.inum
                                                                });
                                                                if (subarrayFound.length == 0) {
                                                                    var secdatalength = secData.dt[i].inv.length;


                                                                    tbldata[0].inv.push(secData.dt[i].inv[0]);


                                                                } else {
                                                                    var index = tbldata.indexOf(subarrayFound[0]);
                                                                    tbldata.splice(index, 1); //delete row first with matched inv

                                                                    tbldata[0].inv.splice(index, 0, secData.dt[i].inv[0]); //insert updated row in the same index of previous row


                                                                }
                                                                logger.log("info", "How many times am i repeated ");
                                                            }

                                                            break;
                                                        case "imp_g": //for  R2
                                                        case "imp_ga": //for  R2
                                                            if (secData.cd == "imp_g") {
                                                                tbldata = gstfile.imp_g;

                                                            } else {
                                                                tbldata = gstfile.imp_ga;

                                                            }

                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                tbldata.push((secData.dt[i]));
                                                            }
                                                            break;
                                                        case "imp_s": //for  R2
                                                        case "imp_sa": //for  R2
                                                            if (secData.cd == "imp_s") {
                                                                tbldata = gstfile.imp_s;

                                                            } else {
                                                                tbldata = gstfile.imp_sa;

                                                            }

                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                tbldata.push((secData.dt[i]));
                                                            }
                                                            break;
                                                        case "itc_rvsl": //for  R2 32
                                                            tbldata = gstfile.itc_rvsl;

                                                            tbldata = secData.dt[0];
                                                            gstfile.itc_rvsl = tbldata;


                                                            break;
                                                        case "txi": //for  R2
                                                        case "atxi": //for  R2
                                                            if (secData.cd == "txi") {
                                                                tbldata = gstfile.txi;

                                                            } else {
                                                                tbldata = gstfile.atxi;

                                                            }
                                                            for (var p = 0; p < secData.dt.length; p++) {
                                                                if (gstin == secData.dt[p].cpty) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    tbldata.push(secData.dt[p]);
                                                                    for (var i = p + 1; i < secData.dt.length; i++) {
                                                                        if (gstin == secData.dt[i].cpty) {
                                                                            isSameGSTIN = gstin;
                                                                        } else {
                                                                            tbldata.push(secData.dt[i]);
                                                                        }
                                                                        if (i == secData.dt.length - 1) {
                                                                            p = secData.dt.length;
                                                                        }

                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "hsnsum":
                                                            //for  R2
                                                            tbldata = gstfile.hsnsum;
                                                            if (typeof tbldata.det == 'object') {
                                                                var total_hsn_objects = gstfile.hsnsum.det.length;
                                                            } else {
                                                                var total_hsn_objects = 0;
                                                            }
                                                            total_hsn_objects++; // num  should atleast be 1

                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                var count = 0;

                                                                for (var j = 0; j < tbldata.det.length; j++) {

                                                                    if (tbldata.det[j].hsn_sc === secData.dt[i].det[0].hsn_sc) {
                                                                        if (!tbldata.det[j].desc)
                                                                            tbldata.det[j].desc = '';
                                                                        if (!secData.dt[i].det[0].desc)
                                                                            secData.dt[i].det[0].desc = '';
                                                                        if ((tbldata.det[j].desc).toLowerCase() === (secData.dt[i].det[0].desc).toLowerCase()) {
                                                                            if ((tbldata.det[j].uqc).toLowerCase() === (secData.dt[i].det[0].uqc).toLowerCase()) {
                                                                                secData.dt[i].det[0].num = tbldata.det[j].num;

                                                                                tbldata.det.splice(j, 1);
                                                                                tbldata.det.splice(j, 0, secData.dt[i].det[0]);
                                                                                count = 1;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                if (count != 1) {
                                                                    secData.dt[i].det[0].num = total_hsn_objects;
                                                                    total_hsn_objects++;

                                                                    tbldata.det.push(secData.dt[i].det[0]);

                                                                } else {
                                                                    if (!secData.dt[i].det[0].hsn_sc) {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].det[0].desc);
                                                                    } else {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].det[0].hsn_sc);
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "nil_supplies": //for  R2

                                                            tbldata = gstfile.nil_supplies;
                                                            tbldata.push(secData.dt[0]);
                                                            break;

                                                        default:
                                                            gstfile['hsnSac'].push((secData.dt));

                                                            break;

                                                    }
                                                }
                                            }
                                            var cache = [];
                                            var configJSON = JSON.stringify(gstfile, function (key, value) {
                                                if (typeof value === 'object' && value !== null) {
                                                    if (cache.indexOf(value) !== -1) {
                                                        // Circular reference found, discard key
                                                        return;
                                                    }
                                                    // Store value in our collection
                                                    cache.push(value);
                                                }
                                                return value;
                                            });
                                            cache = null;

                                            fs.writeFileSync(filename, configJSON); //after pushing the data we need to commit this data into the file.
                                            //res.send();


                                            if (jsonObj.length == 0) {
                                                logger.log("info", "No duplicate invoice found and data added successfully::%s", jsonObj);

                                                if (isSameGSTIN == gstin) {
                                                    var responsegstin = [];
                                                    var gstinKey = {};
                                                    gstinKey.gstin = gstin;
                                                    responsegstin.push(gstinKey);
                                                    callback(err, responsegstin);
                                                } else {

                                                    callback(null, "Success! Returns details added.");
                                                }
                                            } else {
                                                logger.log("info", "duplicate invoice found and non duplicated rows added successfully");
                                                callback(err, jsonObj);
                                            }

                                        }
                                    });


                                }

                            })

                        }
                    })
                } else //when user will come second time and directory is there to save the file.
                // if directory is there we will read the file and append the content into it.
                // if file is not there we need to create.
                {

                    fs.readFile(filename, 'utf8', function (err, data) { // 1. read the file 2.Create file if not exist.  3.Append data if exist
                        if (err) //1. error reading the file
                        {
                            fs.writeFile(filename, formDataFormat, function (err) //create a file since directory is there .
                            {
                                if (err) //error in creating a file
                                {
                                    logger.log("error", "error in creating a file:: %s", err.message);
                                    callback(err, null)
                                } else //file is created
                                {
                                    fs.readFile(filename, 'utf8', function (err, data) {
                                        if (err) //if we are unable to read the file
                                        {
                                            logger.log("error", "Unable to read the file:: %s", err.message);
                                            callback(err, null)

                                        } else // if we are able to read the file
                                        {
                                            var gstfile = JSON.parse(data);
                                            var tbldata;
                                            var jsonObj = [];
                                            /* push data according to table no.*/
                                            for (var k = 0; k < dataObj.length; k++) {
                                                var secData = dataObj[k];

                                                if (!secData.dt[0]) {

                                                    logger.log("info", "data is not there so no need to add empty array");
                                                } else {

                                                    switch (secData.cd) {
                                                        case "b2b":
                                                        case "b2ba":

                                                            if (secData.cd == "b2b") {
                                                                tbldata = gstfile.b2b;

                                                            } else {
                                                                tbldata = gstfile.b2ba;

                                                            }

                                                            for (var p = 0; p < secData.dt.length; p++) {


                                                                if (gstin == secData.dt[p].ctin || gstin == secData.dt[p].inv[0].etin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {

                                                                    var arrayFound = tbldata.myFind({
                                                                        'ctin': secData.dt[p].ctin
                                                                    });
                                                                    var status = secData.dt[p].inv[0].status;
                                                                    if (status) {
                                                                        secData.dt[p].inv[0].status = undefined;
                                                                    }

                                                                    if ((status && status != 'Cancelled') || !status) {
                                                                        if (arrayFound.length == 0) {
                                                                            tbldata.push(secData.dt[p]);
                                                                        } else {
                                                                            var subarray = {};
                                                                            subarray = arrayFound[0].inv;
                                                                            subarray.push(secData.dt[p].inv[0]);
                                                                            common.findAndReplace(tbldata, secData.dt[p].ctin, subarray, secData.cd);
                                                                        }

                                                                    }

                                                                }
                                                            }


                                                            break;
                                                        case "doc_issue":
                                                            tbldata = gstfile.doc_issue;
                                                            if (tbldata['flag']) {
                                                                delete tbldata['flag'];
                                                            }
                                                            var uniKeyAry = [];  // array to store unique key property
                                                            var keyObj = {};

                                                            var tblarray = tbldata.doc_det;


                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                keyObj.doc_num = secData.dt[i].doc_num;


                                                                uniKeyAry.push(keyObj);


                                                                var arrayFound = tblarray.myFind({
                                                                    'doc_num': uniKeyAry[0].doc_num
                                                                });

                                                                if (arrayFound.length != 0) { // if doc_num already exists

                                                                    var docAry = {};
                                                                    docAry = arrayFound[0].docs;
                                                                    for (var inputRow = 0; inputRow < secData.dt[i].docs.length; inputRow++) {
                                                                        var subArrayFound = docAry.myFind({
                                                                            'num': secData.dt[i].docs[inputRow].num
                                                                        });

                                                                        if (subArrayFound.length != 0) {

                                                                            var subIndex = docAry.indexOf(subArrayFound[0]);
                                                                            docAry.splice(subIndex, 1);
                                                                            docAry.splice(subIndex, 0, secData.dt[i].docs[inputRow])
                                                                        }
                                                                        else {
                                                                            docAry.push(secData.dt[i].docs[inputRow]);
                                                                        }

                                                                    }

                                                                }
                                                                else //if doc_num does not exist
                                                                {

                                                                    tblarray.push(secData.dt[i]);
                                                                }



                                                            }
                                                            break;
                                                        case "b2cl":
                                                        case "b2cla":
                                                            if (secData.cd == "b2cl") {
                                                                tbldata = gstfile.b2cl;

                                                            } else {
                                                                tbldata = gstfile.b2cla;

                                                            }


                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                if (gstin == secData.dt[i].inv[0].etin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    var arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos
                                                                    });
                                                                    if (arrayFound.length == 0) {
                                                                        tbldata.push(secData.dt[i]);
                                                                    } else {
                                                                        var subarray = {};
                                                                        subarray = arrayFound[0].inv;
                                                                        subarray.push(secData.dt[i].inv[0]);
                                                                        common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                    }
                                                                }

                                                            }
                                                            break;
                                                        case "b2cs":
                                                            //case "b2csa":
                                                            if (secData.cd == "b2cs") {
                                                                tbldata = gstfile.b2cs;

                                                            }
                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                var count = 0;
                                                                if (gstin == secData.dt[i].etin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {

                                                                    for (var j = 0; j < tbldata.length; j++) {

                                                                        if (tbldata[j].pos === secData.dt[i].pos) {
                                                                            if (tbldata[j].rt === secData.dt[i].rt) {
                                                                                if (tbldata[j].etin === secData.dt[i].etin) {
                                                                                    if (tbldata[j].diff_percent === secData.dt[i].diff_percent) {
                                                                                        tbldata.splice(j, 1);
                                                                                        tbldata.splice(j, 0, secData.dt[i]);
                                                                                        count = 1;
                                                                                    }

                                                                                }

                                                                            }
                                                                        }
                                                                    }
                                                                    if (count != 1) {

                                                                        tbldata.push(secData.dt[i]);

                                                                    } else {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].pos + "_" + secData.dt[i].rt + "_" + secData.dt[i].typ);
                                                                    }
                                                                }

                                                            }
                                                            break;
                                                        case "b2csa":

                                                            tbldata = gstfile.b2csa;
                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound = tbldata.myFind({
                                                                    'pos': secData.dt[i].pos,
                                                                    'omon': secData.dt[i].omon,
                                                                    'diff_percent': secData.dt[i].diff_percent
                                                                });
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0];
                                                                    subarray.push(secData.dt[i]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }

                                                            break;
                                                        case "cdnr":
                                                        case "cdnra":
                                                            if (secData.cd == "cdnr") {
                                                                tbldata = gstfile.cdnr;

                                                            } else {
                                                                tbldata = gstfile.cdnra;

                                                            }
                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                if (gstin == secData.dt[i].ctin) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    var arrayFound = tbldata.myFind({
                                                                        'ctin': secData.dt[i].ctin
                                                                    });
                                                                    var status = secData.dt[i].nt[0].status;
                                                                    if (status) {
                                                                        secData.dt[i].nt[0].status = undefined;
                                                                    }

                                                                    if ((status && status != 'Cancelled') || !status) {
                                                                        if (arrayFound.length == 0) {
                                                                            tbldata.push(secData.dt[i]);
                                                                        } else {
                                                                            var subarray = {};
                                                                            subarray = arrayFound[0].nt;
                                                                            subarray.push(secData.dt[i].nt[0]);
                                                                            common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                                        }
                                                                    }
                                                                }

                                                            }

                                                            break;

                                                        case "cdnur":
                                                        case "cdnura":
                                                            if (secData.cd == 'cdnur') {
                                                                tbldata = gstfile.cdnur;
                                                            } else {
                                                                tbldata = gstfile.cdnura;
                                                            }



                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                var arrayFound = tbldata.myFind({
                                                                    'nt_num': secData.dt[i].nt_num
                                                                });
                                                                var status = secData.dt[i].status;
                                                                if (status) {
                                                                    secData.dt[i].status = undefined;
                                                                }

                                                                if ((status && status != 'Cancelled') || !status) {
                                                                    if (arrayFound.length == 0) {

                                                                        tbldata.push(secData.dt[i]);
                                                                    } else {
                                                                        var subarray = {};
                                                                        subarray = arrayFound[0];
                                                                        subarray.push(secData.dt[i]);
                                                                        common.findAndReplace(tbldata, secData.dt[i].nt_num, subarray, secData.cd);
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "nil":
                                                            if (form == "GSTR2") {
                                                                tbldata = gstfile.nil_supplies;
                                                                tbldata = secData.dt[0];
                                                                gstfile.nil_supplies = tbldata;

                                                            } else {
                                                                tbldata = gstfile.nil;
                                                                for (var p = 0; p < secData.dt.length; p++) {
                                                                    tbldata.inv.push(secData.dt[p]);
                                                                }
                                                            }
                                                            break;
                                                        case "exp":
                                                        case "expa":
                                                            if (secData.cd == "exp") {
                                                                tbldata = gstfile.exp;

                                                            } else {
                                                                tbldata = gstfile.expa;

                                                            }

                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                var arrayFound = tbldata.myFind({
                                                                    'exp_typ': secData.dt[i].exp_typ
                                                                });
                                                                var status = secData.dt[i].inv[0].status;
                                                                if (status) {
                                                                    secData.dt[i].inv[0].status = undefined;
                                                                }

                                                                if ((status && status != 'Cancelled') || !status) {
                                                                    if (arrayFound.length == 0) {
                                                                        tbldata.push(secData.dt[i]);
                                                                    } else {
                                                                        var subarray = {};
                                                                        subarray = arrayFound[0].inv;
                                                                        subarray.push(secData.dt[i].inv[0]);
                                                                        common.findAndReplace(tbldata, secData.dt[i].exp_typ, subarray, secData.cd);
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "at":


                                                            tbldata = gstfile.at;



                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos
                                                                    });
                                                                }
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0].itms;
                                                                    subarray.push(secData.dt[i].itms[0]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }

                                                            break;
                                                        case "ata":

                                                            tbldata = gstfile.ata;


                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon
                                                                    });
                                                                }

                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0];
                                                                    subarray.push(secData.dt[i]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }

                                                            break;
                                                        case "atadj":


                                                            tbldata = gstfile.atadj;


                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos
                                                                    });
                                                                }
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0].itms;
                                                                    subarray.push(secData.dt[i].itms[0]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }
                                                            break;
                                                        case "atadja":

                                                            tbldata = gstfile.atadja;


                                                            tbldata.push(secData.dt[0]);
                                                            for (var i = 1; i < secData.dt.length; i++) {
                                                                var arrayFound;
                                                                if (form == "GSTR1") {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon,
                                                                        'diff_percent': secData.dt[i].diff_percent
                                                                    });
                                                                } else {
                                                                    arrayFound = tbldata.myFind({
                                                                        'pos': secData.dt[i].pos,
                                                                        'omon': secData.dt[i].omon
                                                                    });
                                                                }
                                                                if (arrayFound.length == 0) {
                                                                    tbldata.push(secData.dt[i]);
                                                                } else {
                                                                    var subarray = {};
                                                                    subarray = arrayFound[0];
                                                                    subarray.push(secData.dt[i]);
                                                                    common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                                }
                                                            }
                                                            break;
                                                        case "hsn":
                                                            tbldata = gstfile.hsn;
                                                            if (tbldata['flag']) {
                                                                delete tbldata['flag'];
                                                            }
                                                            if (typeof tbldata.data == 'object') {
                                                                var total_hsn_objects = gstfile.hsn.data.length;
                                                            } else {
                                                                var total_hsn_objects = 0;
                                                            }
                                                            total_hsn_objects++; // num  should atleast be 1

                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                var count = 0;

                                                                for (var j = 0; j < tbldata.data.length; j++) {

                                                                    if (tbldata.data[j].hsn_sc === secData.dt[i].data[0].hsn_sc) {
                                                                        if (!tbldata.data[j].desc)
                                                                            tbldata.data[j].desc = '';


                                                                        if (!secData.dt[i].data[0].desc)
                                                                            secData.dt[i].data[0].desc = '';


                                                                        if ((tbldata.data[j].desc).toLowerCase() === (secData.dt[i].data[0].desc).toLowerCase()) {
                                                                            //todo
                                                                            if ((tbldata.data[j].uqc).toLowerCase() === (secData.dt[i].data[0].uqc).toLowerCase()) {
                                                                                if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, fp)) {
                                                                                    if (tbldata.data[j].rt == secData.dt[i].data[0].rt) {
                                                                                        secData.dt[i].data[0].num = tbldata.data[j].num;

                                                                                        tbldata.data.splice(j, 1);
                                                                                        tbldata.data.splice(j, 0, secData.dt[i].data[0]);
                                                                                        count = 1;
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    secData.dt[i].data[0].num = tbldata.data[j].num;

                                                                                    tbldata.data.splice(j, 1);
                                                                                    tbldata.data.splice(j, 0, secData.dt[i].data[0]);
                                                                                    count = 1;
                                                                                }
                                                                            }

                                                                        }

                                                                    }
                                                                }
                                                                if (count != 1) {

                                                                    var maxNum = 0;
                                                                    forEach(tbldata.data, function (data, index) {
                                                                        if (data.num >= maxNum) {
                                                                            maxNum = data.num + 1;
                                                                        }
                                                                    });

                                                                    secData.dt[i].data[0].num = ((total_hsn_objects >= maxNum) ? total_hsn_objects : maxNum);
                                                                    total_hsn_objects++;



                                                                    tbldata.data.push(secData.dt[i].data[0]);

                                                                } else {
                                                                    if (!secData.dt[i].data[0].hsn_sc) {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].data[0].desc);
                                                                    } else {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].data[0].hsn_sc);
                                                                    }
                                                                }
                                                            }
                                                            break;

                                                        case "b2bur": //for  R2
                                                        case "b2bura": //for R2
                                                            if (secData.cd == "b2bur") {
                                                                tbldata = gstfile.b2bur;

                                                            } else {
                                                                tbldata = gstfile.b2bura;

                                                            }
                                                            tbldata[0].inv.push(secData.dt[0].inv[0]);

                                                            for (var i = 1; i < secData.dt.length; i++) {

                                                                var arrayFound = tbldata[0].inv;

                                                                var subarrayFound = arrayFound.myFind({
                                                                    'inum': secData.dt[i].inv.inum
                                                                });
                                                                if (subarrayFound.length == 0) {
                                                                    var secdatalength = secData.dt[i].inv.length;


                                                                    tbldata[0].inv.push(secData.dt[i].inv[0]);


                                                                } else {
                                                                    var index = tbldata.indexOf(subarrayFound[0]);
                                                                    tbldata.splice(index, 1); //delete row first with matched inv

                                                                    tbldata[0].inv.splice(index, 0, secData.dt[i].inv[0]); //insert updated row in the same index of previous row


                                                                }

                                                            }

                                                            break;
                                                        case "imp_g": //for  R2
                                                        case "imp_ga": //for  R2
                                                            if (secData.cd == "imp_g") {
                                                                tbldata = gstfile.imp_g;

                                                            } else {
                                                                tbldata = gstfile.imp_ga;

                                                            }

                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                tbldata.push((secData.dt[i]));
                                                            }
                                                            break;
                                                        case "imp_s": //for  R2
                                                        case "imp_sa": //for  R2
                                                            if (secData.cd == "imp_s") {
                                                                tbldata = gstfile.imp_s;

                                                            } else {
                                                                tbldata = gstfile.imp_sa;

                                                            }

                                                            for (var i = 0; i < secData.dt.length; i++) {
                                                                tbldata.push((secData.dt[i]));
                                                            }
                                                            break;
                                                        case "itc_rvsl": //for  R2 13
                                                            tbldata = gstfile.itc_rvsl;
                                                            tbldata = secData.dt[0];
                                                            gstfile.itc_rvsl = tbldata;

                                                            break;
                                                        case "txi": //for  R2
                                                        case "atxi": //for  R2
                                                            if (secData.cd == "txi") {
                                                                tbldata = gstfile.txi;

                                                            } else {
                                                                tbldata = gstfile.atxi;

                                                            }
                                                            for (var p = 0; p < secData.dt.length; p++) {
                                                                if (gstin == secData.dt[p].cpty) {
                                                                    isSameGSTIN = gstin;
                                                                } else {
                                                                    tbldata.push(secData.dt[p]);
                                                                    for (var i = p + 1; i < secData.dt.length; i++) {
                                                                        if (gstin == secData.dt[i].cpty) {
                                                                            isSameGSTIN = gstin;
                                                                        } else {
                                                                            tbldata.push(secData.dt[i]);
                                                                        }
                                                                        if (i == secData.dt.length - 1) {
                                                                            p = secData.dt.length;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "hsnsum": //for  R2
                                                            tbldata = gstfile.hsnsum;
                                                            if (typeof tbldata.det == 'object') {
                                                                var total_hsn_objects = gstfile.hsnsum.det.length;
                                                            } else {
                                                                var total_hsn_objects = 0;
                                                            }
                                                            total_hsn_objects++; // num  should atleast be 1

                                                            for (var i = 0; i < secData.dt.length; i++) {

                                                                var count = 0;

                                                                for (var j = 0; j < tbldata.det.length; j++) {


                                                                    if (tbldata.det[j].hsn_sc === secData.dt[i].det[0].hsn_sc) {
                                                                        if (!tbldata.det[j].desc)
                                                                            tbldata.det[j].desc = '';
                                                                        if (!secData.dt[i].det[0].desc)
                                                                            secData.dt[i].det[0].desc = '';
                                                                        if ((tbldata.det[j].desc).toLowerCase() === (secData.dt[i].det[0].desc).toLowerCase()) {

                                                                            if ((tbldata.det[j].uqc).toLowerCase() === (secData.dt[i].det[0].uqc).toLowerCase()) {


                                                                                secData.dt[i].det[0].num = tbldata.det[j].num;
                                                                                tbldata.det.splice(j, 1);
                                                                                tbldata.det.splice(j, 0, secData.dt[i].det[0]);
                                                                                count = 1;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                if (count != 1) {
                                                                    secData.dt[i].det[0].num = total_hsn_objects;
                                                                    total_hsn_objects++;

                                                                    tbldata.det.push(secData.dt[i].det[0]);

                                                                } else {
                                                                    if (!secData.dt[i].det[0].hsn_sc) {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].det[0].desc);
                                                                    } else {
                                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].det[0].hsn_sc);
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        case "nil_supplies": //for  R2
                                                            tbldata = gstfile.nil_supplies;
                                                            tbldata = secData.dt[0];
                                                            gstfile.nil_supplies = tbldata;
                                                            break;

                                                        default:
                                                            gstfile['hsnSac'].push((secData.dt));

                                                            break;

                                                    }
                                                }

                                            }
                                            var cache = [];
                                            var configJSON = JSON.stringify(gstfile, function (key, value) {
                                                if (typeof value === 'object' && value !== null) {
                                                    if (cache.indexOf(value) !== -1) {
                                                        // Circular reference found, discard key
                                                        return;
                                                    }
                                                    // Store value in our collection
                                                    cache.push(value);
                                                }
                                                return value;
                                            });
                                            cache = null;
                                            fs.writeFileSync(filename, configJSON); //after pushing the data we need to commit this data into the file.
                                            //res.send();

                                            if (jsonObj.length == 0) {
                                                logger.log("info", "No duplicate invoice found and data added successfully::%s", jsonObj);

                                                if (isSameGSTIN == gstin) {
                                                    var responsegstin = [];
                                                    var gstinKey = {};
                                                    gstinKey.gstin = gstin;
                                                    responsegstin.push(gstinKey);
                                                    callback(err, responsegstin);
                                                } else {

                                                    callback(null, "Success! Returns details added.");
                                                }
                                            } else {
                                                logger.log("info", "duplicate invoice found and non duplicated rows added successfully");
                                                callback(err, jsonObj);
                                            }
                                        }

                                    });
                                }

                            });
                        } else // If file is there.
                        {
                            //                            console.log(data)
                            var gstfile = JSON.parse(data);
                            if (type == "Upload") {
                                var b2ba = [];
                                var b2bur = [];
                                var b2bura = [];
                                var imp_g = [];
                                var imp_ga = [];
                                var nil_supplies = [];
                                var imp_s = [];
                                var imp_sa = [];
                                var hsnsum = [];
                                var cdnra = [];
                                var itc_rvsl = {};
                                var txi = [];
                                var atxi = [];
                                var atadj = [];
                                var inv = {
                                    "inv": []
                                };
                                b2bur[0] = inv;
                                b2bura[0] = inv;
                                gstfile.b2ba = b2ba;
                                gstfile.b2bur = b2bur;
                                gstfile.b2bura = b2bura;
                                gstfile.imp_g = imp_g;
                                gstfile.imp_ga = imp_ga;
                                gstfile.nil_supplies = nil_supplies;
                                gstfile.imp_s = imp_s;
                                gstfile.imp_sa = imp_sa;
                                gstfile.hsnsum = hsnsum;
                                gstfile.cdnra = cdnra;
                                gstfile.itc_rvsl = itc_rvsl;
                                gstfile.txi = txi;
                                gstfile.atxi = atxi;
                                gstfile.atadj = atadj;

                                fs.writeFileSync(filename, JSON.stringify(gstfile));

                            }
                            var tbldata;

                            for (var k = 0; k < dataObj.length; k++) {

                                var secData = dataObj[k];
                                //Inorder to bypass the if condition in case of second flow for mentioned sections need to check the data. if data not exists thn we need to set flag as D.
                                var isFirstFlowImport = true; //default true for first flow -- added by pavani
                                if (type && type == 'Import') {
                                    if (secData.cd == 'nil' || secData.cd == 'doc_issue' || secData.cd == 'hsn')
                                        isFirstFlowImport = false; //dafault true for second flow except these sections
                                }
                                if (!secData.dt[0] && isFirstFlowImport) {

                                    logger.log("info", "data is not there so no need to add empty array");
                                } else {

                                    switch (secData.cd) {
                                        case "b2b":

                                            if (secData.cd == "b2b") {
                                                if (!gstfile.b2b) {
                                                    gstfile.b2b = [];
                                                }
                                                tbldata = gstfile.b2b;

                                            } else {
                                                if (!gstfile.b2ba) {
                                                    gstfile.b2ba = [];
                                                }
                                                tbldata = gstfile.b2ba;

                                            }

                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {

                                                if (gstin == secData.dt[i].ctin || gstin == secData.dt[i].inv[0].etin) {
                                                    isSameGSTIN = gstin;
                                                } else {

                                                    keyObj.ctin = secData.dt[i].ctin;


                                                    keyObj.inum = secData.dt[i].inv[0].inum;



                                                    responseinvce.push(keyObj);

                                                    var arrayFound = tbldata.myFind({
                                                        'ctin': responseinvce[0].ctin
                                                    });

                                                    if (arrayFound.length != 0) {

                                                        var subarray = {};
                                                        subarray = arrayFound[0].inv;
                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].inum
                                                        });
                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        if (subArrayFound.length == 0) {

                                                            subarray.push(secData.dt[i].inv[0]);
                                                            common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                        } else {

                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].inv[0])
                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].inum);
                                                        }

                                                    } else {

                                                        //If the first row in the excel doesn't carry CFS flag but the 2nd one does,
                                                        //then CFS flag doesn't get populated.
                                                        //To resolve this issue we need to find a row for the same ctin which has CFS flag
                                                        //and swap both.
                                                        //If no match is found, return as it is
                                                        if (form == "GSTR2")
                                                            findAndSwapCFSInv(secData, i);
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }

                                            }
                                            break;
                                        case "b2ba":

                                            if (!gstfile.b2ba) {
                                                gstfile.b2ba = [];
                                            }
                                            tbldata = gstfile.b2ba;



                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {

                                                if (gstin == secData.dt[i].ctin || gstin == secData.dt[i].inv[0].etin) {
                                                    isSameGSTIN = gstin;
                                                } else {

                                                    keyObj.ctin = secData.dt[i].ctin;


                                                    keyObj.inum = secData.dt[i].inv[0].inum;
                                                    keyObj.oinum = secData.dt[i].inv[0].oinum;



                                                    responseinvce.push(keyObj);

                                                    var arrayFound = tbldata.myFind({
                                                        'ctin': responseinvce[0].ctin
                                                    });

                                                    if (arrayFound.length != 0) {

                                                        var subarray = {};
                                                        subarray = arrayFound[0].inv;
                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].inum
                                                        });
                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        if (subArrayFound.length == 0) {
                                                            var subArrayFound2 = subarray.myFind({
                                                                'oinum': responseinvce[0].oinum
                                                            });
                                                            if (subArrayFound2.length == 0) {
                                                                subarray.push(secData.dt[i].inv[0]);
                                                                common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                            }
                                                            else {
                                                                subarray.splice(subIndex, 1);
                                                                subarray.splice(subIndex, 0, secData.dt[i].inv[0])
                                                                jsonObj.push(secData.cd + ":" + responseinvce[0].oinum);
                                                            }


                                                        } else {

                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].inv[0])
                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].inum);
                                                        }

                                                    } else {

                                                        //If the first row in the excel doesn't carry CFS flag but the 2nd one does,
                                                        //then CFS flag doesn't get populated.
                                                        //To resolve this issue we need to find a row for the same ctin which has CFS flag
                                                        //and swap both.
                                                        //If no match is found, return as it is
                                                        if (form == "GSTR2")
                                                            findAndSwapCFSInv(secData, i);
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }

                                            }




                                            break;
                                        case "doc_issue":
                                            if (!gstfile.doc_issue) {
                                                gstfile.doc_issue = {
                                                    "doc_det": []
                                                };
                                            }
                                            tbldata = gstfile.doc_issue;

                                            var uniKeyAry = [];  // array to store unique key property
                                            var keyObj = {};

                                            var tblarray = tbldata.doc_det;

                                            for (var i = 0; i < secData.dt.length; i++) {

                                                keyObj.doc_num = secData.dt[i].doc_num;


                                                uniKeyAry.push(keyObj);


                                                var arrayFound = tblarray.myFind({
                                                    'doc_num': uniKeyAry[0].doc_num
                                                });

                                                if (arrayFound.length != 0) { // if doc_num already exists

                                                    var docAry = {};
                                                    docAry = arrayFound[0].docs;
                                                    for (var inputRow = 0; inputRow < secData.dt[i].docs.length; inputRow++) {
                                                        var subArrayFound = docAry.myFind({
                                                            'num': secData.dt[i].docs[inputRow].num
                                                        });

                                                        if (subArrayFound.length != 0) {
                                                            var subIndex = docAry.indexOf(subArrayFound[0]);
                                                            docAry.splice(subIndex, 1);
                                                            docAry.splice(subIndex, 0, secData.dt[i].docs[inputRow]);

                                                        }
                                                        else {
                                                            docAry.push(secData.dt[i].docs[inputRow]);
                                                        }

                                                    }

                                                }
                                                else //if doc_num does not exist
                                                {

                                                    tblarray.push(secData.dt[i]);
                                                }



                                            }
                                            if (type == 'Import') {
                                                if (!secData.dt.length && tbldata['flag']) {
                                                    tbldata.doc_det = [];
                                                    tbldata['flag'] = 'D';  //if they have cleared the whole data in excel then we are setting it to D
                                                }
                                                else {
                                                    if (tbldata['flag'])
                                                        delete tbldata['flag']; //otherwise delete flag N which is not required in schema
                                                }
                                            }
                                            break;
                                        case "b2cl":

                                            if (!gstfile.b2cl) {
                                                gstfile.b2cl = [];

                                            }
                                            tbldata = gstfile.b2cl;

                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {
                                                if (gstin == secData.dt[i].inv[0].etin) {
                                                    isSameGSTIN = gstin;
                                                } else {
                                                    keyObj.pos = secData.dt[i].pos;


                                                    keyObj.inum = secData.dt[i].inv[0].inum;



                                                    responseinvce.push(keyObj);




                                                    var arrayFound = tbldata.myFind({
                                                        'pos': responseinvce[0].pos
                                                    });

                                                    if (arrayFound.length != 0) {

                                                        var subarray = {};
                                                        subarray = arrayFound[0].inv;
                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].inum
                                                        });
                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        if (subArrayFound.length == 0) {


                                                            subarray.push(secData.dt[i].inv[0]);
                                                            common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                        } else {

                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].inv[0])

                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].inum);
                                                        }

                                                    } else {
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }

                                            }
                                            break;
                                        case "b2cla":
                                            if (!gstfile.b2cla) {
                                                gstfile.b2cla = [];

                                            }
                                            tbldata = gstfile.b2cla;

                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {
                                                if (gstin == secData.dt[i].inv[0].etin) {
                                                    isSameGSTIN = gstin;
                                                } else {
                                                    keyObj.pos = secData.dt[i].pos;


                                                    keyObj.inum = secData.dt[i].inv[0].inum;
                                                    keyObj.oinum = secData.dt[i].inv[0].oinum;


                                                    responseinvce.push(keyObj);




                                                    var arrayFound = tbldata.myFind({
                                                        'pos': responseinvce[0].pos
                                                    });

                                                    if (arrayFound.length != 0) {

                                                        var subarray = {};
                                                        subarray = arrayFound[0].inv;
                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].inum
                                                        });
                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        if (subArrayFound.length == 0) {

                                                            var subArrayFound2 = subarray.myFind({
                                                                'oinum': responseinvce[0].oinum
                                                            });
                                                            if (subArrayFound2.length == 0) {
                                                                subarray.push(secData.dt[i].inv[0]);
                                                                common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                            }
                                                            else {
                                                                subarray.splice(subIndex, 1);
                                                                subarray.splice(subIndex, 0, secData.dt[i].inv[0])
                                                                jsonObj.push(secData.cd + ":" + responseinvce[0].oinum);
                                                            }

                                                        } else {

                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].inv[0])

                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].inum);
                                                        }

                                                    } else {
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }

                                            }
                                            break;
                                        case "b2cs":

                                            if (!gstfile.b2cs) {
                                                gstfile.b2cs = [];

                                            }
                                            tbldata = gstfile.b2cs;

                                            for (var i = 0; i < secData.dt.length; i++) {
                                                var count = 0;
                                                if (gstin == secData.dt[i].etin) {
                                                    isSameGSTIN = gstin;
                                                } else {
                                                    for (var j = 0; j < tbldata.length; j++) {

                                                        if (tbldata[j].pos === secData.dt[i].pos) {
                                                            if (tbldata[j].rt === secData.dt[i].rt) {
                                                                if (tbldata[j].etin === secData.dt[i].etin) {
                                                                    if (tbldata[j].diff_percent === secData.dt[i].diff_percent) {
                                                                        tbldata.splice(j, 1);
                                                                        tbldata.splice(j, 0, secData.dt[i]);
                                                                        count = 1;
                                                                    }
                                                                }

                                                            }
                                                        }
                                                    }

                                                    if (count != 1) {


                                                        tbldata.push(secData.dt[i]);

                                                    } else {
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].pos + "_" + secData.dt[i].rt + "_" + secData.dt[i].typ);
                                                    }
                                                }

                                            }
                                            break;

                                        case "b2csa":

                                            if (!gstfile.b2csa) {
                                                gstfile.b2csa = [];
                                            }

                                            tbldata = gstfile.b2csa;

                                            var responseinvce = [];
                                            var keyObj = {};
                                            for (var i = 0; i < secData.dt.length; i++) {


                                                keyObj.pos = secData.dt[i].pos;
                                                keyObj.omon = secData.dt[i].omon;
                                                keyObj.diff_percent = secData.dt[i].diff_percent;



                                                responseinvce.push(keyObj);

                                                var arrayFound;
                                                if (form == "GSTR1") {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': responseinvce[0].pos,
                                                        'omon': responseinvce[0].omon,
                                                        'diff_percent': responseinvce[0].diff_percent
                                                    });
                                                } else {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': responseinvce[0].pos,
                                                        'omon': responseinvce[0].omon
                                                    });
                                                }


                                                var Index = tbldata.indexOf(arrayFound[0]);
                                                if (arrayFound.length != 0) {
                                                    tbldata.splice(Index, 1);
                                                    tbldata.splice(Index, 0, secData.dt[i])
                                                    jsonObj.push(secData.cd + ":" + responseinvce[0].pos + '-' + responseinvce[0].omon);
                                                } else {

                                                    tbldata.push(secData.dt[i]);
                                                }
                                            }


                                            break;
                                        case "cdnr":
                                            if (form == 'GSTR1') {
                                                if (!gstfile.cdnr) {
                                                    gstfile.cdnr = [];
                                                }
                                                tbldata = gstfile.cdnr;
                                            } else {
                                                if (type == 'Import') {
                                                    if (!gstfile.cdn) {
                                                        gstfile.cdn = [];
                                                    }
                                                    tbldata = gstfile.cdn;
                                                } else {
                                                    if (!gstfile.cdnr) {
                                                        gstfile.cdnr = [];
                                                    }
                                                    tbldata = gstfile.cdnr;
                                                }
                                            }

                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {

                                                if (gstin == secData.dt[i].ctin) {
                                                    isSameGSTIN = gstin;
                                                } else {
                                                    keyObj.ctin = secData.dt[i].ctin;


                                                    keyObj.nt_num = secData.dt[i].nt[0].nt_num;



                                                    responseinvce.push(keyObj);




                                                    var arrayFound = tbldata.myFind({
                                                        'ctin': responseinvce[0].ctin
                                                    });

                                                    if (arrayFound.length != 0) {

                                                        var subarray = {};
                                                        subarray = arrayFound[0].nt;
                                                        var subArrayFound = subarray.myFind({
                                                            'nt_num': responseinvce[0].nt_num
                                                        });
                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        if (subArrayFound.length == 0) {
                                                            subarray.push(secData.dt[i].nt[0]);
                                                            common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                        } else {

                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].nt[0])

                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].nt_num);
                                                        }

                                                    } else {
                                                        //If the first row in the excel doesn't carry CFS flag but the 2nd one does,
                                                        //then CFS flag doesn't get populated.
                                                        //To resolve this issue we need to find a row for the same ctin which has CFS flag
                                                        //and swap both.
                                                        //If no match is found, return as it is
                                                        if (form == "GSTR2")
                                                            findAndSwapCFSInv(secData, i);
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }

                                            }
                                            break;
                                        case "cdnra":

                                            if (!gstfile.cdnra) {
                                                gstfile.cdnra = [];
                                            }
                                            tbldata = gstfile.cdnra;



                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {

                                                if (gstin == secData.dt[i].ctin) {
                                                    isSameGSTIN = gstin;
                                                } else {
                                                    keyObj.ctin = secData.dt[i].ctin;


                                                    keyObj.nt_num = secData.dt[i].nt[0].nt_num;
                                                    keyObj.ont_num = secData.dt[i].nt[0].ont_num;



                                                    responseinvce.push(keyObj);




                                                    var arrayFound = tbldata.myFind({
                                                        'ctin': responseinvce[0].ctin
                                                    });

                                                    if (arrayFound.length != 0) {

                                                        var subarray = {};
                                                        subarray = arrayFound[0].nt;
                                                        var subArrayFound = subarray.myFind({
                                                            'nt_num': responseinvce[0].nt_num
                                                        });
                                                        var subIndex = subarray.indexOf(subArrayFound[0]);


                                                        if (subArrayFound.length == 0) {
                                                            var subArrayFound2 = subarray.myFind({
                                                                'ont_num': responseinvce[0].ont_num
                                                            });
                                                            if (subArrayFound2.length == 0) {
                                                                subarray.push(secData.dt[i].nt[0]);
                                                                common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                            } else {
                                                                subarray.splice(subIndex, 1);
                                                                subarray.splice(subIndex, 0, secData.dt[i].nt[0])
                                                                jsonObj.push(secData.cd + ":" + responseinvce[0].ont_num);
                                                            }

                                                        } else {

                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].nt[0])
                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].nt_num);
                                                        }

                                                    } else {
                                                        //If the first row in the excel doesn't carry CFS flag but the 2nd one does,
                                                        //then CFS flag doesn't get populated.
                                                        //To resolve this issue we need to find a row for the same ctin which has CFS flag
                                                        //and swap both.
                                                        //If no match is found, return as it is
                                                        if (form == "GSTR2")
                                                            findAndSwapCFSInv(secData, i);
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }

                                            }
                                            break;
                                        case "cdnur":

                                            logger.log("info", "entered in cdnur section");
                                            i
                                            if (!gstfile.cdnur) {
                                                gstfile.cdnur = [];
                                            }
                                            tbldata = gstfile.cdnur;


                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {



                                                keyObj.nt_num = secData.dt[i].nt_num;



                                                responseinvce.push(keyObj);




                                                var arrayFound = tbldata.myFind({
                                                    'nt_num': responseinvce[0].nt_num
                                                });

                                                if (arrayFound.length != 0) {
                                                    var Index = tbldata.indexOf(arrayFound[0]);
                                                    tbldata.splice(Index, 1);
                                                    tbldata.splice(Index, 0, secData.dt[i])
                                                    jsonObj.push(secData.cd + ":" + responseinvce[0].nt_num);
                                                } else {
                                                    tbldata.push(secData.dt[i]);
                                                }
                                            }
                                            break;
                                        case "cdnura":
                                            logger.log("info", "entered in cdnur section");

                                            if (!gstfile.cdnura) {
                                                gstfile.cdnura = [];
                                            } tbldata = gstfile.cdnura;



                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {



                                                keyObj.nt_num = secData.dt[i].nt_num;
                                                keyObj.ont_num = secData.dt[i].ont_num;



                                                responseinvce.push(keyObj);




                                                var arrayFound = tbldata.myFind({
                                                    'nt_num': responseinvce[0].nt_num
                                                });
                                                var Index = tbldata.indexOf(arrayFound[0]);
                                                if (arrayFound.length != 0) {
                                                    tbldata.splice(Index, 1);
                                                    tbldata.splice(Index, 0, secData.dt[i])
                                                    jsonObj.push(secData.cd + ":" + responseinvce[0].nt_num);
                                                } else {
                                                    var arrayFound2 = tbldata.myFind({
                                                        'ont_num': responseinvce[0].ont_num
                                                    });
                                                    if (arrayFound2.length != 0) {
                                                        tbldata.splice(Index, 1);
                                                        tbldata.splice(Index, 0, secData.dt[i])
                                                        jsonObj.push(secData.cd + ":" + responseinvce[0].ont_num);
                                                    } else {
                                                        tbldata.push(secData.dt[i]);
                                                    }
                                                }
                                            }
                                            break;
                                        case "exp":
                                            if (!gstfile.exp) {
                                                gstfile.exp = [];

                                            }
                                            tbldata = gstfile.exp;

                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {
                                                keyObj.exp_typ = secData.dt[i].exp_typ;


                                                keyObj.inum = secData.dt[i].inv[0].inum;



                                                responseinvce.push(keyObj);




                                                var arrayFound = tbldata.myFind({
                                                    'exp_typ': responseinvce[0].exp_typ
                                                });

                                                if (arrayFound.length != 0) {

                                                    var subarray = {};
                                                    subarray = arrayFound[0].inv;
                                                    var subArrayFound = subarray.myFind({
                                                        'inum': responseinvce[0].inum
                                                    });
                                                    var subIndex = subarray.indexOf(subArrayFound[0]);


                                                    if (subArrayFound.length == 0) {
                                                        subarray.push(secData.dt[i].inv[0]);
                                                        common.findAndReplace(tbldata, secData.dt[i].exp_typ, subarray, secData.cd);
                                                    } else {

                                                        subarray.splice(subIndex, 1);
                                                        subarray.splice(subIndex, 0, secData.dt[i].inv[0])

                                                        jsonObj.push(secData.cd + ":" + responseinvce[0].inum);
                                                    }

                                                } else {
                                                    tbldata.push(secData.dt[i]);
                                                }
                                            }
                                            break;
                                        case "expa":
                                            if (!gstfile.expa) {
                                                gstfile.expa = [];
                                            }
                                            tbldata = gstfile.expa




                                            var responseinvce = [];
                                            var keyObj = {};

                                            for (var i = 0; i < secData.dt.length; i++) {
                                                keyObj.exp_typ = secData.dt[i].exp_typ;


                                                keyObj.inum = secData.dt[i].inv[0].inum;
                                                keyObj.oinum = secData.dt[i].inv[0].oinum;



                                                responseinvce.push(keyObj);




                                                var arrayFound = tbldata.myFind({
                                                    'exp_typ': responseinvce[0].exp_typ
                                                });

                                                if (arrayFound.length != 0) {

                                                    var subarray = {};
                                                    subarray = arrayFound[0].inv;
                                                    var subArrayFound = subarray.myFind({
                                                        'inum': responseinvce[0].inum
                                                    });
                                                    var subIndex = subarray.indexOf(subArrayFound[0]);


                                                    if (subArrayFound.length == 0) {
                                                        var subArrayFound2 = subarray.myFind({
                                                            'oinum': responseinvce[0].oinum
                                                        });
                                                        if (subArrayFound2.length == 0) {
                                                            subarray.push(secData.dt[i].inv[0]);
                                                            common.findAndReplace(tbldata, secData.dt[i].ctin, subarray, secData.cd);
                                                        }
                                                        else {
                                                            subarray.splice(subIndex, 1);
                                                            subarray.splice(subIndex, 0, secData.dt[i].inv[0])
                                                            jsonObj.push(secData.cd + ":" + responseinvce[0].oinum);
                                                        };
                                                    } else {

                                                        subarray.splice(subIndex, 1);
                                                        subarray.splice(subIndex, 0, secData.dt[i].inv[0])

                                                        jsonObj.push(secData.cd + ":" + responseinvce[0].inum);
                                                    }

                                                } else {
                                                    tbldata.push(secData.dt[i]);
                                                }
                                            }
                                            break;
                                        case "at":
                                        //case "ata" :                                       
                                        case "txi":
                                            if (secData.cd == "at") {
                                                if (!gstfile.at) {
                                                    gstfile.at = [];
                                                }
                                                tbldata = gstfile.at;

                                            } else {
                                                if (!gstfile.txi) {
                                                    gstfile.txi = [];
                                                }
                                                tbldata = gstfile.txi;

                                            }
                                            var isExisting = true;
                                            var keyObj = {};
                                            for (var i = 0; i < secData.dt.length; i++) {

                                                var arrayFound;
                                                if (form == "GSTR1") {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': secData.dt[i].pos,
                                                        'diff_percent': secData.dt[i].diff_percent
                                                    });
                                                } else {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': secData.dt[i].pos
                                                    });
                                                }

                                                var newIndex = tbldata.indexOf(arrayFound[0]);
                                                if (arrayFound.length == 0) {
                                                    isExisting = false;
                                                    tbldata.push(secData.dt[i]);
                                                } else {
                                                    if (isExisting == false) {
                                                        var subarray = {};
                                                        subarray = arrayFound[0].itms;
                                                        subarray.push(secData.dt[i].itms[0]);
                                                        common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                    } else {


                                                        if (keyObj.index == null || keyObj.index != newIndex) {
                                                            tbldata[newIndex] = secData.dt[i];

                                                            keyObj.index = newIndex;
                                                        } else {
                                                            var subarray = {};
                                                            subarray = arrayFound[0].itms;
                                                            subarray.push(secData.dt[i].itms[0]);
                                                            common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                        }

                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].pos);

                                                    }

                                                }


                                            }
                                            break;
                                        case "ata":
                                        case "atadja":
                                            if (secData.cd == 'ata') {
                                                if (!gstfile.ata) {
                                                    gstfile.ata = [];
                                                }
                                                tbldata = gstfile.ata;
                                            } else {
                                                if (!gstfile.atadja) {
                                                    gstfile.atadja = [];
                                                }

                                                tbldata = gstfile.atadja;
                                            }
                                            var responseinvce = [];
                                            var keyObj = {};
                                            for (var i = 0; i < secData.dt.length; i++) {


                                                keyObj.pos = secData.dt[i].pos;
                                                keyObj.omon = secData.dt[i].omon;
                                                if (form == "GSTR1")
                                                    keyObj.diff_percent = secData.dt[i].diff_percent;

                                                responseinvce.push(keyObj);
                                                var arrayFound;
                                                if (form == "GSTR1") {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': responseinvce[0].pos,
                                                        'omon': responseinvce[0].omon,
                                                        'diff_percent': responseinvce[0].diff_percent
                                                    });
                                                } else {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': responseinvce[0].pos,
                                                        'omon': responseinvce[0].omon
                                                    });
                                                }
                                                var Index = tbldata.indexOf(arrayFound[0]);
                                                if (arrayFound.length != 0) {
                                                    tbldata.splice(Index, 1);
                                                    tbldata.splice(Index, 0, secData.dt[i])
                                                    jsonObj.push(secData.cd + ":" + responseinvce[0].pos);
                                                } else {

                                                    tbldata.push(secData.dt[i]);
                                                }
                                            }


                                            break;


                                        case "atadj":


                                            if (gstfile.txpd) {
                                                tbldata = gstfile.txpd;
                                            } else {
                                                if (type == "Import") {
                                                    if (!gstfile.atadj) {
                                                        gstfile.atadj = [];
                                                    }
                                                    tbldata = gstfile.atadj;
                                                } else {
                                                    tbldata = gstfile.atadj || [];
                                                }
                                            }

                                            var isExisting = true;
                                            var keyObj = {};
                                            for (var i = 0; i < secData.dt.length; i++) {
                                                var arrayFound;

                                                if (form == "GSTR1") {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': secData.dt[i].pos,
                                                        'diff_percent': secData.dt[i].diff_percent
                                                    });
                                                } else {
                                                    arrayFound = tbldata.myFind({
                                                        'pos': secData.dt[i].pos
                                                    });
                                                }

                                                var newIndex = tbldata.indexOf(arrayFound[0]);
                                                if (arrayFound.length == 0) {
                                                    isExisting = false;
                                                    tbldata.push(secData.dt[i]);
                                                } else {
                                                    if (isExisting == false) {
                                                        var subarray = {};
                                                        subarray = arrayFound[0].itms;
                                                        subarray.push(secData.dt[i].itms[0]);
                                                        common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                    } else {


                                                        if (keyObj.index == null || keyObj.index != newIndex) {
                                                            tbldata[newIndex] = secData.dt[i];

                                                            keyObj.index = newIndex;
                                                        } else {
                                                            var subarray = {};
                                                            subarray = arrayFound[0].itms;
                                                            subarray.push(secData.dt[i].itms[0]);
                                                            common.findAndReplace(tbldata, secData.dt[i].pos, subarray, secData.cd);
                                                        }

                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].pos);

                                                    }

                                                }


                                            }

                                            break;

                                        case "hsn":
                                            if (!gstfile.hsn) {
                                                gstfile.hsn = {
                                                    "data": []
                                                };
                                            }
                                            tbldata = gstfile.hsn;
                                            if (typeof tbldata.data == 'object') {
                                                var total_hsn_objects = gstfile.hsn.data.length;
                                            } else {
                                                var total_hsn_objects = 0;
                                            }
                                            total_hsn_objects++; // num  should atleast be 1
                                            for (var i = 0; i < secData.dt.length; i++) {

                                                var count = 0;

                                                for (var j = 0; j < tbldata.data.length; j++) {

                                                    if (tbldata.data[j].hsn_sc === secData.dt[i].data[0].hsn_sc) {
                                                        if (!tbldata.data[j].desc)
                                                            tbldata.data[j].desc = '';


                                                        if (!secData.dt[i].data[0].desc)
                                                            secData.dt[i].data[0].desc = '';

                                                        //todo
                                                        if ((tbldata.data[j].uqc).toLowerCase() === (secData.dt[i].data[0].uqc).toLowerCase()) {
                                                            if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, fp)) {
                                                                if (tbldata.data[j].rt == secData.dt[i].data[0].rt) {
                                                                    secData.dt[i].data[0].num = tbldata.data[j].num;

                                                                    tbldata.data.splice(j, 1);
                                                                    tbldata.data.splice(j, 0, secData.dt[i].data[0]);
                                                                    count = 1;
                                                                }
                                                            }
                                                            else if (((tbldata.data[j].desc).toLowerCase()) === (secData.dt[i].data[0].desc).toLowerCase()) {
                                                                secData.dt[i].data[0].num = tbldata.data[j].num;

                                                                tbldata.data.splice(j, 1);
                                                                tbldata.data.splice(j, 0, secData.dt[i].data[0]);
                                                                count = 1;
                                                            }
                                                        }



                                                    }
                                                }
                                                if (count != 1) {

                                                    var maxNum = 0;
                                                    forEach(tbldata.data, function (data, index) {
                                                        if (data.num >= maxNum) {
                                                            maxNum = data.num + 1;
                                                        }
                                                    });

                                                    secData.dt[i].data[0].num = ((total_hsn_objects >= maxNum) ? total_hsn_objects : maxNum);
                                                    total_hsn_objects++;


                                                    tbldata.data.push(secData.dt[i].data[0]);

                                                } else {
                                                    if (!secData.dt[i].data[0].hsn_sc) {
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].data[0].desc);
                                                    } else {
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].data[0].hsn_sc);
                                                    }
                                                }
                                            }
                                            if (type == 'Import') {
                                                if (!secData.dt.length && tbldata['flag']) {
                                                    tbldata.data = [];
                                                    tbldata['flag'] = 'D';  //if they have cleared the whole data in excel then we are setting it to D
                                                }
                                                else {
                                                    if (tbldata['flag'])
                                                        delete tbldata['flag']; //otherwise delete flag N which is not required in schema
                                                }
                                            }
                                            break;
                                        case "nil":
                                            if (!gstfile.nil) {
                                                gstfile.nil = {
                                                    "inv": []
                                                };
                                            }
                                            tbldata = gstfile.nil;

                                            tbldata.inv = []; // empty the array to update
                                            for (var p = 0; p < secData.dt.length; p++) {
                                                tbldata.inv.push(secData.dt[p]);
                                            }
                                            if (type == 'Import') {
                                                if (!secData.dt.length && tbldata['flag']) {
                                                    tbldata['flag'] = 'D';  //if they have cleared the whole data in excel then we are setting it to D
                                                }
                                                else {
                                                    if (tbldata['flag'])
                                                        delete tbldata['flag']; //otherwise delete flag N which is not required in schema
                                                }
                                            }



                                            break;
                                        case "b2bur": //for  R2
                                        case "b2bura": //for R2
                                            if (secData.cd == "b2bur") {
                                                if (!gstfile.b2bur) {
                                                    var newb2bur = [];
                                                    newb2bur.push({});
                                                    newb2bur[0].inv = [];
                                                    gstfile.b2bur = newb2bur;
                                                }
                                                tbldata = gstfile.b2bur;

                                            } else {
                                                if (!gstfile.b2bura) {
                                                    var newb2bura = [];
                                                    newb2bura.push({});
                                                    newb2bura[0].inv = [];
                                                    gstfile.b2bura = newb2bura;
                                                }
                                                tbldata = gstfile.b2bura;

                                            }
                                            var existingInv = tbldata[0].inv;
                                            for (var i = 0; i < secData.dt.length; i++) {

                                                var subarrayFound = existingInv.myFind({
                                                    'inum': secData.dt[i].inv[0].inum
                                                });
                                                if (subarrayFound.length === 0) {
                                                    tbldata[0].inv.push(secData.dt[i].inv[0]);


                                                } else {

                                                    var index = existingInv.indexOf(subarrayFound[0]);
                                                    tbldata[0].inv[index] = secData.dt[i].inv[0] //delete row first with matched inv

                                                    jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);

                                                }

                                            }
                                            break;
                                        case "imp_g": //for  R2
                                        case "imp_ga": //for  R2
                                            if (secData.cd == "imp_g") {
                                                if (!gstfile.imp_g) {
                                                    gstfile.imp_g = [];
                                                }
                                                tbldata = gstfile.imp_g;

                                            } else {
                                                if (!gstfile.imp_ga) {
                                                    gstfile.imp_ga = [];
                                                }
                                                tbldata = gstfile.imp_ga;

                                            }


                                            //changes by prakash - start
                                            for (var i = 0; i < secData.dt.length; i++) {
                                                var count = 0;

                                                for (var j = 0; j < tbldata.length; j++) {

                                                    if (tbldata[j].port_code === secData.dt[i].port_code) {
                                                        if (tbldata[j].boe_num === secData.dt[i].boe_num) {

                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            count = 1;



                                                        }
                                                    }
                                                }

                                                if (count != 1) {


                                                    tbldata.push(secData.dt[i]);

                                                } else {
                                                    jsonObj.push(secData.cd + ":" + secData.dt[i].port_code + "_" + secData.dt[i].boe_num);
                                                }


                                            }
                                            //changes by prakash - end
                                            break;
                                        case "imp_s": //for  R2
                                        case "imp_sa": //for  R2
                                            if (secData.cd == "imp_s") {
                                                if (!gstfile.imp_s) {
                                                    gstfile.imp_s = [];
                                                }
                                                tbldata = gstfile.imp_s;

                                            } else {
                                                if (!gstfile.imp_sa) {
                                                    gstfile.imp_sa = [];
                                                }
                                                tbldata = gstfile.imp_sa;
                                            }
                                            for (var i = 0; i < secData.dt.length; i++) {
                                                var arrayFound = tbldata.myFind({
                                                    'inum': secData.dt[i].inum
                                                });
                                                if (arrayFound.length < 1) {
                                                    tbldata.push((secData.dt[i]));
                                                } else {

                                                    var indexd = tbldata.indexOf(arrayFound[0]);
                                                    tbldata.splice(indexd, 1);
                                                    tbldata.splice(indexd, 0, secData.dt[i]);
                                                    jsonObj.push(secData.cd + ":" + secData.dt[i].inum);
                                                }
                                            }
                                            break;
                                        case "itc_rvsl": //for  R2  24
                                            if (!gstfile.itc_rvsl) {
                                                gstfile.itc_rvsl = [];
                                            }
                                            tbldata = gstfile.itc_rvsl;
                                            tbldata = secData.dt[0];
                                            gstfile.itc_rvsl = tbldata;

                                            break;
                                        case "txi": //for  R2
                                        case "atxi": //for  R2
                                            if (secData.cd == "txi") {
                                                if (!gstfile.txi) {
                                                    gstfile.txi = [];
                                                }
                                                tbldata = gstfile.txi;

                                            } else {
                                                if (!gstfile.atxi) {
                                                    gstfile.atxi = [];
                                                }
                                                tbldata = gstfile.atxi;

                                            }
                                            for (var p = 0; p < secData.dt.length; p++) {
                                                if (gstin == secData.dt[p].cpty) {
                                                    isSameGSTIN = gstin;
                                                } else {
                                                    tbldata.push(secData.dt[p]);
                                                    for (var i = p + 1; i < secData.dt.length; i++) {
                                                        if (gstin == secData.dt[i].cpty) {
                                                            isSameGSTIN = gstin;
                                                        } else {
                                                            var arrayFound = tbldata.myFind({
                                                                'dnum': secData.dt[i].dnum
                                                            });
                                                            if (arrayFound.length != 1) {
                                                                tbldata.push((secData.dt[i]));
                                                            } else {
                                                                jsonObj.push(secData.cd + ":" + secData.dt[i].dnum);
                                                            }
                                                        }
                                                        if (i == secData.dt.length - 1) {
                                                            p = secData.dt.length;
                                                        }
                                                    }
                                                }
                                            }
                                            break;
                                        case "hsnsum": //for  R2

                                            if (!gstfile.hsnsum) {
                                                var newhsnsum = {};
                                                newhsnsum.det = [];
                                                gstfile.hsnsum = newhsnsum
                                            }
                                            tbldata = gstfile.hsnsum;
                                            if (typeof tbldata.det == 'object') {
                                                var total_hsn_objects = tbldata.det.length;
                                            } else {
                                                var total_hsn_objects = 0;
                                            }


                                            total_hsn_objects++; // num  should atleast be 1
                                            for (var i = 0; i < secData.dt.length; i++) {

                                                var count = 0;
                                                if (tbldata.length !== 0) {
                                                    // added this by to check whether data is there or nat


                                                    for (var j = 0; j < tbldata.det.length; j++) {

                                                        if (tbldata.det[j] && tbldata.det[j].hsn_sc === secData.dt[i].det[0].hsn_sc) {
                                                            if (!tbldata.det[j].desc)
                                                                tbldata.det[j].desc = '';


                                                            if (!secData.dt[i].det[0].desc)
                                                                secData.dt[i].det[0].desc = '';


                                                            if ((tbldata.det[j].desc).toLowerCase() === (secData.dt[i].det[0].desc).toLowerCase()) {

                                                                if ((tbldata.det[j].uqc).toLowerCase() === (secData.dt[i].det[0].uqc).toLowerCase()) {


                                                                    //todo
                                                                    secData.dt[i].det[0].num = tbldata.det[j].num;

                                                                    if (secData.dt[i].det[0]) {
                                                                        tbldata.det.splice(j, 1);
                                                                        tbldata.det.splice(j, 0, secData.dt[i].det[0]);
                                                                        count = 1;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                if (count != 1) {


                                                    secData.dt[i].det[0].num = total_hsn_objects;
                                                    total_hsn_objects++;

                                                    if (secData.dt[i].det[0]) {
                                                        tbldata.det.push(secData.dt[i].det[0]);
                                                    }

                                                } else {
                                                    if (!secData.dt[i].det[0].hsn_sc) {
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].det[0].desc);
                                                    } else {
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].det[0].hsn_sc);
                                                    }
                                                }
                                            }
                                            for (var hu = 0; hu < tbldata.det.length; hu++) {
                                                if (tbldata.det[hu] == null || tbldata.det[hu] === undefined) {
                                                    tbldata.det.splice(hu, 1);
                                                    hu--;
                                                }
                                            }

                                            break;
                                        case "nil_supplies": //for  R2
                                            if (!gstfile.nil_supplies) {
                                                gstfile.nil_supplies = {};
                                            }
                                            tbldata = gstfile.nil_supplies;
                                            tbldata.splice(0, 1);
                                            tbldata.push(secData.dt[0]);
                                            break;

                                        default:
                                            logger.log("info", "Section not present");
                                    }
                                }
                            }

                            var cache = [];
                            var configJSON = JSON.stringify(gstfile, function (key, value) {
                                if (typeof value === 'object' && value !== null) {
                                    if (cache.indexOf(value) !== -1) {
                                        // Circular reference found, discard key
                                        return;
                                    }
                                    // Store value in our collection
                                    cache.push(value);
                                }
                                return value;
                            });
                            cache = null;




                            fs.writeFileSync(filename, configJSON); // write into file after pushing data into it.
                            if (jsonObj.length == 0) {
                                logger.log("info", "No duplicate invoice found and data added successfully::%s", jsonObj);

                                if (isSameGSTIN == gstin) {
                                    var responsegstin = [];
                                    var gstinKey = {};
                                    gstinKey.gstin = gstin;
                                    responsegstin.push(gstinKey);
                                    callback(err, responsegstin);
                                } else {
                                    callback(null, "Success! Returns details added.");
                                }
                            } else {
                                logger.log("info", "duplicate invoice found and non duplicated rows added successfully");
                                callback(err, jsonObj);
                            }
                        }
                    })

                }




            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While adding the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return Details Added Successfully :: %s", result);
                response.success(result, res)
            }

        })

    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while adding the invoices:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};


var generateZip = function (req, res) {
    logger.log("info", "Entering Offline File:: generateZip");
    /* var errorObject = null;
         var gstin = req.body.gstin;
         var form = req.body.form;
         var fy = req.body.fy;
         var month = req.body.month;
         var dir,filename;
    
         if (form == "GSTR1") {
             dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month; // to read the file whose zip need to be created
             filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json'
         } else if (type == "Upload") {
             dir = uploadedFiledir + gstin + "_" + form + "_" + fy + "_" + month;
             filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';
         } else {
             dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month; // to read the file whose zip need to be created
             filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json'
    
         }
     try {
    
         fs.readFile(filename, 'utf8', function(err, data) {
             if (err) console.log(err);
             else {
    
    
                 var gstfile = JSON.parse(data)
                 gstfile = omitEmpty(gstfile);
                 fs.writeFileSync(dir + "/tabledata" + '.json', JSON.stringify(gstfile));
    
                 var zip = new AdmZip();
                 zip.addFile(gstin + '_' + form + '_' + fy + '_' + month + '.json', new Buffer(JSON.stringify(gstfile)), "");
                 var buff = zip.toBuffer();
    
    
    
             fs.writeFile("./public/upload/GSTR.zip", buff, function(err) { // creating zip with data
                 if (err) {
                     throw err;
                 } else {
                     //     console.log("inside else of fs.writeFile");
                     res.setHeader('Content-type', 'application/zip');
                     res.setHeader('Content-disposition', 'attachment; filename=' + "GSTR.zip");
                     var fileStream = fs.createReadStream("./public/upload/GSTR.zip");
    
                     fileStream.on('open', function(err) {
                         if (err) {
                             //  console.log(err);
                         }
                         fileStream.pipe(res);
                         res.on('finish', function() {
                             del.sync(['./public/generatedFile/*']);
                             del.sync([dir+ '/' + 'tabledata.json']);
                             del.sync(['./public/upload/GSTR.zip']);
    
                         });
                     });
                 }
             });
    
             }
         });
    
    
     } catch (err) {
         errorObject = {
             statusCd: errorConstant.STATUS_500,
             errorCd: errorConstant.STATUS_500,
         };
         logger.log("error", "Unexpected Error while generating the file");
         response.error(errorObject, res);
     } finally {
    
     }*/
};
var generateErrorFile = function (req, res) {

    logger.log("info", "Entering Offline File:: generateErrorFile ");
    var errorObject = null;


    try {

        var gstin = req.body.gstin;
        var form = req.body.form;
        var fy = req.body.fy;
        var fp = req.body.fp;
        var gt = req.body.gt;
        var month = req.body.month;
        var errFileName = req.body.errFileName;
        var filename;
        var dir;
        async.waterfall([
            function (callback) {

                logger.log("info", "entered in async.waterfall function 1");
                common.formDataFormat(req, function (formDataFormat) {
                    logger.log("info", "entered in async.waterfall formDataFormat");
                    callback(null, formDataFormat)
                })
            },
            function (formDataFormat, callback) {

                dir = uploadedErrdir + gstin + "_" + form + "_" + fy + "_" + month;
                mkdirp.sync(dir);

                filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';

                logger.log("info", " creating formDataFormat of form :: %s ", form);
                if (!fs.existsSync(dir)) // when user will come first time and no directory is there to save the file.
                // user will enter only once in this.
                //After entering  file will get created.
                {
                    mkdirp(dir, function (err) // if directory is not there will create directory
                    {

                        if (err) // if we are facing issue in creating the directory
                        {
                            logger.log("error", "Unexpected error while creating the directory:: %s", err.message);
                            callback(err, null)
                        } else // if we are not facing issue in creating the directory.
                        {

                            fs.writeFile(filename, formDataFormat, function (err) // after creating the directory we are creating file inside that in order to save the table data.
                            {

                                if (err) // if we are facing issue in creating the file
                                {
                                    logger.log("error", "Unexpected error while creating the file:: %s", err.message);
                                    callback(err, null);
                                } else // file is created
                                {


                                    fs.readFile(filename, 'utf8', function (err, data) {
                                        if (err) //if we are unable to read the file
                                        {
                                            logger.log("error", "Unexpected error while reading the file:: %s", err.message);
                                            callback(err, null)

                                        } else // if we are able to read the file
                                        {
                                            gstfileNew = data;
                                            callback(null, gstfileNew)
                                        }
                                    });


                                }

                            })

                        }
                    })
                } else {
                    fs.writeFile(filename, formDataFormat, function (err) // after creating the directory we are creating file inside that in order to save the table data.
                    {

                        if (err) // if we are facing issue in creating the file
                        {

                            logger.log("error", "Unexpected error while creating the file:: %s", err.message);
                            callback(err, null);
                        } else // file is created
                        {


                            fs.readFile(filename, 'utf8', function (err, data) {
                                if (err) //if we are unable to read the file
                                {
                                    logger.log("error", "Unexpected error while reading the file:: %s", err.message);
                                    callback(err, null)

                                } else // if we are able to read the file
                                {
                                    var gstfileNew = JSON.parse(data);
                                    callback(null, gstfileNew);
                                }
                            });


                        }

                    })
                }

            },
            function (gstfileNew, callback) {
                logger.log("info", " emtering the third function");
                dir = uploadedErrdir; // to read the error file
                filename = dir + errFileName.replace("./error/", "");


                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) console.log(err);
                    else {
                        var gstfile = JSON.parse(data)
                        var errorData = gstfile.error_report;

                        var tbldata;

                        for (var key in errorData) {
                            var value = errorData[key];
                            var newValue = [];
                            if (form == "GSTR1" && key == "hsnsum") { key = "hsn"; }
                            switch (key) {
                                case "b2b":
                                case "b2ba":
                                case "b2bur":
                                case "b2bura":
                                    var temp = {};
                                    var obj = null;
                                    for (var i = 0; i < value.length; i++) {
                                        if (value[i].error_msg == "M") {
                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            if (value[i])
                                                for (var j = 0; j < value[i].inv.length; j++) {
                                                    delete value[i].inv[j]['old_inum'];
                                                    delete value[i].inv[j]['diffval'];
                                                    value[i].inv[j].diff_percent = +value[i].inv[j].diff_percent;
                                                    if (value[i].inv[j].diff_percent != 0.65)
                                                        value[i].inv[j].diff_percent = null;
                                                }


                                            obj = value[i];

                                            if (!temp[obj.key]) {
                                                temp[obj.key] = obj;
                                            } else {
                                                temp[obj.key].inv.push(obj.inv[0]);
                                            }
                                            var result = [];
                                            for (var prop in temp)
                                                result.push(temp[prop]);


                                            gstfileNew[key] = result;

                                        } else {
                                            newValue.push(value[i]);
                                        }



                                    }
                                    errorData[key] = newValue;

                                    break;
                                case "b2cl":
                                case "b2cla":
                                    var temp = {};
                                    var obj = null;
                                    for (var i = 0; i < value.length; i++) {



                                        if (value[i].error_msg == "M") {


                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            if (value[i])
                                                for (var j = 0; j < value[i].inv.length; j++) {
                                                    delete value[i].inv[j]['old_inum'];
                                                    delete value[i].inv[j]['diffval'];
                                                    value[i].inv[j].diff_percent = +value[i].inv[j].diff_percent;
                                                    if (value[i].inv[j].diff_percent != 0.65)
                                                        value[i].inv[j].diff_percent = null;
                                                }

                                            obj = value[i];

                                            if (!temp[obj.key]) {
                                                temp[obj.key] = obj;
                                            } else {
                                                temp[obj.key].inv.push(obj.inv[0]);
                                            }

                                            var result = [];
                                            for (var prop in temp)
                                                result.push(temp[prop]);


                                            gstfileNew[key] = result;

                                        } else {
                                            newValue.push(value[i]);
                                        }



                                    }
                                    errorData[key] = newValue;

                                    break;
                                case "b2cs":
                                case "b2csa":
                                    for (var i = 0; i < value.length; i++) {
                                        if (value[i].error_msg == "M") {

                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            delete value[i]['diffval'];
                                            if (value[i].diff_percent) {
                                                value[i].diff_percent = +value[i].diff_percent;
                                                if (value[i].diff_percent != 0.65)
                                                    value[i].diff_percent = null;
                                            }

                                            gstfileNew[key].push(value[i]);
                                        } else {
                                            newValue.push(value[i]);
                                        }

                                    }

                                    errorData[key] = newValue;
                                    break;
                                case "cdnr":
                                case "cdnra":
                                    var temp = {};
                                    var obj = null;
                                    for (var i = 0; i < value.length; i++) {



                                        if (value[i].error_msg == "M") {


                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];

                                            if (value[i])
                                                for (var j = 0; j < value[i].nt.length; j++) {
                                                    delete value[i].nt[j]['old_ntnum'];
                                                    delete value[i].nt[j]['old_inum'];
                                                    delete value[i].nt[j]['diffval'];
                                                    //deleting rsn since it has been removed from schema - Subrat
                                                    delete value[i].nt[j]['rsn'];
                                                    value[i].nt[j].diff_percent = +value[i].nt[j].diff_percent;
                                                    if (value[i].nt[j].diff_percent != 0.65)
                                                        value[i].nt[j].diff_percent = null;
                                                }

                                            obj = value[i];

                                            if (!temp[obj.key]) {
                                                temp[obj.key] = obj;
                                            } else {
                                                temp[obj.key].nt.push(obj.nt[0]);
                                            }

                                            var result = [];
                                            for (var prop in temp)
                                                result.push(temp[prop]);

                                            gstfileNew[key] = result;

                                        } else {
                                            newValue.push(value[i]);
                                        }



                                    }
                                    errorData[key] = newValue;

                                    break;
                                case "cdnur":
                                case "cdnura":
                                    for (var i = 0; i < value.length; i++) {
                                        if (value[i].error_msg == "M") {
                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            delete value[i]['diffval'];
                                            //deleting rsn since it has been removed from schema - Subrat
                                            delete value[i]['rsn'];
                                            value[i].diff_percent = +value[i].diff_percent;
                                            gstfileNew[key].push(value[i]);
                                            if (value[i].diff_percent != 0.65)
                                                value[i].diff_percent = null;

                                        } else {
                                            newValue.push(value[i]);
                                        }


                                    }

                                    errorData[key] = newValue;
                                    break;
                                case "at":
                                case "ata":
                                case "txi":
                                    for (var i = 0; i < value.length; i++) {
                                        if (value[i].error_msg == "M") {

                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            delete value[i]['diffval'];
                                            value[i].diff_percent = +value[i].diff_percent;
                                            if (value[i].diff_percent != 0.65)
                                                value[i].diff_percent = null;
                                            gstfileNew[key].push(value[i]);

                                        } else {
                                            newValue.push(value[i]);
                                        }


                                    }
                                    errorData[key] = newValue;

                                    break;
                                case "txpd":
                                case "txpda":
                                    for (var i = 0; i < value.length; i++) {
                                        if (value[i].error_msg == "M") {
                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            delete value[i]['diffval'];
                                            value[i].diff_percent = +value[i].diff_percent;
                                            if (value[i].diff_percent != 0.65)
                                                value[i].diff_percent = null;
                                            if (key == 'txpd')
                                                gstfileNew.atadj.push(value[i]);
                                            else {
                                                if (!gstfileNew[key])
                                                    gstfileNew[key] = [];
                                                gstfileNew.txpda.push(value[i]);
                                            }
                                        } else {
                                            newValue.push(value[i]);
                                        }

                                    }
                                    errorData[key] = newValue;

                                    break;
                                case "exp":
                                case "expa":
                                    var temp = {};
                                    var obj = null;
                                    for (var i = 0; i < value.length; i++) {



                                        if (value[i].error_msg == "M") {


                                            delete value[i]["error_msg"];
                                            delete value[i]["error_cd"];
                                            if (value[i])
                                                for (var j = 0; j < value[i].inv.length; j++) {
                                                    delete value[i].inv[j]['old_inum'];

                                                    delete value[i].inv[j]['diffval'];
                                                    value[i].inv[j].diff_percent = +value[i].inv[j].diff_percent;
                                                    if (value[i].inv[j].diff_percent != 0.65)
                                                        value[i].inv[j].diff_percent = null;
                                                }

                                            gstfileNew[key].push(value[i]);

                                        } else {
                                            newValue.push(value[i]);
                                        }



                                    }
                                    errorData[key] = newValue;

                                    break;
                                case "nil":
                                    if (value[0] != 'undefined') {
                                        if (value[0]["error_msg"] != 'undefined' && value[0]["error_cd"] != 'undefined') {
                                            delete value[0]["error_msg"];
                                            delete value[0]["error_cd"];
                                        }
                                    }
                                    if (value[0] != 'undefined' && value[0]["chksum"] != 'undefined') {
                                        delete value[0]["chksum"];
                                    }
                                    var subArray = {};
                                    var finalArray = [];
                                    angular.forEachCustom(value[0].inv, function (inv, i) {
                                        //if does not exists
                                        if (Object.keys(subArray).indexOf(inv.sply_ty) == -1) {
                                            subArray[inv.sply_ty] = inv;
                                            finalArray.push(inv);

                                        }
                                    });

                                    gstfileNew.nil = finalArray;
                                    errorData[key] = newValue;
                                case "nil_supplies":
                                    if (typeof value[0] !== 'undefined')
                                        value = value[0];
                                    if (value.error_msg == "M") {

                                        delete value["error_msg"];
                                        delete value["error_cd"];
                                        gstfileNew[key] = value;
                                    } else {
                                        newValue.push(value[i]);
                                    }

                                    errorData[key] = newValue;
                                    break;
                                case "doc_issue":
                                    errorData[key] = newValue;
                                    break;
                                case "hsn":
                                    if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, gstfileNew.fp)) {
                                        var temp = { data: [] }
                                        value.forEach(function (inv, index) {
                                            delete value[index]["error_msg"];
                                            delete value[index]["error_cd"];
                                            delete value[index]["chksum"];
                                            delete value[index]["select"];
                                            inv.data.forEach(function (val, index) {
                                                delete val.error_msg
                                                temp.data.push(val)
                                            });
                                        });

                                        gstfileNew.hsn = temp;
                                    }
                                    else {
                                        // for (var j = 0; j < value[0].data.length; j++) {

                                        delete value[0]["error_msg"];
                                        delete value[0]["error_cd"];


                                        // }
                                        delete value[0].chksum;
                                        gstfileNew.hsn = value[0];
                                    }
                                    break;
                                case "hsnsum":
                                    if (typeof value[0] !== 'undefined')
                                        value = value[0];
                                    if (form == 'GSTR1') {
                                        for (var j = 0; j < value[0].data.length; j++) {



                                            delete value[0].data[j]["error_msg"];
                                            delete value[0].data[j]["error_cd"];




                                        }
                                        delete value[0].chksum;
                                        gstfileNew.hsn = value[0];
                                    }
                                    else {
                                        for (var j = 0; j < value.det.length; j++) {
                                            if (value.det[j].error_msg == "M") {


                                                delete value.det[j]["error_msg"];
                                                delete value.det[j]["error_cd"];
                                                gstfileNew.hsnsum.push(value[i]);
                                            } else {
                                                newValue.push(value[i]);
                                            }


                                        }
                                    }
                                    errorData[key] = newValue;
                                    break;


                            }


                        }
                        gstfile.error_report = errorData;

                    }

                    if (gstfileNew.atadj) {
                        gstfileNew.txpd = gstfileNew.atadj;
                        gstfileNew.atadj = [];
                    }

                    gstfileNew = omitEmpty(gstfileNew);
                    gstfileNew = deleteSec(gstfileNew);
                    gstfileNew = fixUQC(gstfileNew);

                    gstfileNew.cdnur = removePOS(gstfileNew.cdnur, 'cdnur')
                    gstfileNew.cdnura = removePOS(gstfileNew.cdnura, 'cdnura')
                    gstfileNew.cdnr = removePOS(gstfileNew.cdnr, 'cdnr')
                    gstfileNew.cdnra = removePOS(gstfileNew.cdnra, 'cdnra')
                    gstfileNew.b2cs = fixPOS(gstfileNew.b2cs, 'b2cs')

                    // changes added for removing iamt of SEWOP by janhavi - start  
                    for (var key in gstfileNew) {
                        switch (key) {
                            case "b2b":
                            case "b2ba":
                                if (gstfileNew[key] != null) {
                                    flatObject(gstfileNew[key], key);
                                }
                                break;
                            case "cdnr":
                            case "cdnra":
                                if (gstfileNew[key] != null) {
                                    flatObject(gstfileNew[key], key);
                                }
                                break;
                            case "cdnur":
                            case "cdnura":
                                if (gstfileNew[key] != null) {
                                    flatObjectCDNUR(gstfileNew[key]);
                                }
                                break;
                            case "exp":
                            case "expa":
                                if (gstfileNew[key] != null) {
                                    flatObjectExp(gstfileNew[key]);
                                }
                                break;
                        }
                    }
                    //changes by janhavi end's here
                    //changes made by prakash - start 
                    var respObj = {};
                    var gen_dir = "./public/generatedFile/";
                    var sys_date = new Date();
                    var date_stamp = sys_date.getDate() + '-' + (sys_date.getMonth() + 1) + '-' + sys_date.getFullYear() + '_' + (sys_date.getHours()) + 'h' + '_' + sys_date.getMinutes() + 'm' + '_' + sys_date.getSeconds() + 's';
                    var fp_date = (sys_date.getDate()).toString() + (sys_date.getMonth() + 1).toString() + (sys_date.getFullYear()).toString();
                    var single_dir = gen_dir + date_stamp + "/";
                    mkdirp(single_dir, function (err) {
                        if (err) {
                            logger.log("error", "error while creating the directory :: %s ", err.message);
                        }
                    });


                    fs.writeFile(single_dir + "returns" + "_" + fp_date + "_" + form.substring(3) + "_" + gstin + "_" + "offline" + ".json", JSON.stringify(gstfileNew), function (err) {

                        if (err) {
                            // something went wrong, file probably not written.
                            return callback(err);
                        }

                        fs.exists(single_dir + "returns" + "_" + fp_date + "_" + form.substring(3) + "_" + gstin + "_" + "offline" + ".json", function (exists) {
                            if (exists) {
                                // do stuff
                                respObj.down_dir = single_dir.replace("./public/", "");

                                var filenameArr = [];


                                fs.readdir(single_dir, function (err, files) {

                                    if (err) {
                                        console.log(err);
                                    } else {
                                        for (var i = 0; i < files.length; i++) {

                                            if (path.extname(files[i]) === ".json") {

                                                filenameArr.push(files[i]);
                                                respObj.filenameArr = filenameArr;
                                            }
                                        }
                                    }

                                    res.send(respObj)
                                    res.end();
                                });
                            }
                        });

                    });
                    res.on('finish', function () {

                        del.sync([uploadedErrdir + gstin + "_" + form + "_" + fy + "_" + month]);
                    });
                    //changes made by prakash - end
                });
            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While adding the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return Details Added Successfully :: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        logger.log("info", "I did not enter the try block");
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected Error");
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};
var setDeleteFlag = function (req, res) {
    logger.log("info", "Entering Offline File:: setDeleteFlag ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {

                var msgflag = false;
                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var fileName = req.body.returnFileName;
                var tbl_data = req.body.tbl_data;
                var dir;

                logger.log("info", "Entering Offline File:: setDeleteFlag with tbl_data :: %s", tbl_data);
                logger.log("info", "Entering Offline File:: setDeleteFlag with tblcd :: %s", tblcd);
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of unique keys to update
                var type = req.body.type;
                var filename;
                dir = uploadedImpFiledir;
                filename = dir + "/" + fileName.replace("./download", "");
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(err, null)
                    } else {
                        var gstfile = JSON.parse(data);
                        //console.log("gstfile",gstfile)

                        var tbldata;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = gstfile.b2b;
                                } else {
                                    tbldata = gstfile.b2ba;
                                }
                                logger.log("info", "Entering Offline File:: setDeleteFlag with b2b");

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });

                                    for (var index = 0; index < tbldata.length; index++) {

                                        var subarray = {};

                                        subarray = arrayFound[0].inv;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }

                                        if (subArrayFound.length != 0) {

                                            for (var fIndex = 0; fIndex < subArrayFound.length; fIndex++) {
                                                if ((((subArrayFound[fIndex].updby === "S" && subArrayFound[fIndex].cflag !== 'R') || !subArrayFound[fIndex].updby) && form === "GSTR1") || (subArrayFound[fIndex].updby === "R" && form === "GSTR2")) {
                                                    var invIndex = subarray.indexOf(subArrayFound[fIndex]);

                                                    if (subarray[invIndex]['chksum']) {
                                                        subarray[invIndex]['flag'] = "D";

                                                        if (((subarray[invIndex]['irn'] != "" && subarray[invIndex]['irn'] != undefined) || (subarray[invIndex]['srctyp'] != "" && subarray[invIndex]['srctyp'] != undefined) || (subarray[invIndex]['irngendate'] != "" && subarray[invIndex]['irngendate'] != undefined))) {
                                                            if (subarray[invIndex]['irn'])
                                                                delete subarray[invIndex]['irn'];
                                                            if (subarray[invIndex]['irngendate'])
                                                                delete subarray[invIndex]['irngendate'];
                                                            if (subarray[invIndex]['srctyp'])
                                                                delete subarray[invIndex]['srctyp'];
                                                        }
                                                        msgflag = true;

                                                    } else {
                                                        subarray.splice(invIndex, 1);
                                                    }
                                                }
                                            }

                                        }
                                    }
                                }
                                break;
                            case "doc_issue":
                                tbldata = gstfile.doc_issue;
                                var tblarray = tbldata.doc_det;
                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tblarray.myFind({ //find the doc_num
                                        'doc_num': invdltArray[i].doc_num
                                    });
                                    if (arrayFound.length != 0) {
                                        var docAry = {};
                                        docAry = arrayFound[0].docs;

                                        var subArrayFound = docAry.myFind({// find the row to delete
                                            'num': invdltArray[i].num
                                        });

                                        if (subArrayFound.length != 0) {

                                            var subIndex = docAry.indexOf(subArrayFound[0]);

                                            docAry.splice(subIndex, 1);//delete the row

                                        }
                                    }
                                }
                                for (var tbLen = tblarray.length - 1; tbLen >= 0; tbLen--) {

                                    var restAry = tblarray[tbLen].docs;
                                    if (restAry.length === 0) {
                                        tblarray.splice(tbLen, 1);
                                    }
                                    else {
                                        for (var j = 0; j < restAry.length; j++) {

                                            restAry[j].num = j + 1;//reset the num property
                                        }
                                    }

                                }

                                if (tblarray.length === 0) {

                                    tbldata.flag = "D";

                                }

                                //Added by Subrat - if there are no docs in a doc_num, delete the doc_num entry
                                //This was added since it caused issue while importing the data again.
                                for (var index = 0; index < tbldata.doc_det.length; index++) {
                                    var doc_len = tbldata.doc_det[index].docs.length;

                                    if (doc_len == 0) {
                                        tbldata.doc_det.splice(index, 1);
                                        --index;
                                    }
                                }
                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    tbldata = gstfile.b2cl;
                                } else {
                                    tbldata = gstfile.b2cla;
                                }

                                logger.log("info", "Entering Offline File:: setDeleteFlag with b2cl");


                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = arrayFound[0].inv;

                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);



                                            if (subarray[invIndex]['chksum']) {
                                                subarray[invIndex]['flag'] = "D";
                                            } else {
                                                subarray.splice(invIndex, 1);
                                            }


                                        }
                                    }
                                }


                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    tbldata = gstfile.b2cs;
                                } else {
                                    tbldata = gstfile.b2csa;
                                }

                                var ukey;
                                for (var k = tbldata.length - 1; k >= 0; k--) {
                                    if (tblcd == "b2cs")
                                        ukey = tbldata[k].pos + "_" + tbldata[k].rt + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    else
                                        ukey = tbldata[k].omon + "_" + tbldata[k].pos + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    for (var i = 0; i < invdltArray.length; i++) {

                                        if (ukey == invdltArray[i].uni_key) {

                                            if (tbldata[k]['chksum']) {
                                                tbldata[k]['flag'] = "D";
                                            } else {
                                                tbldata.splice(k, 1);
                                            }

                                        }


                                    }

                                }
                                break;
                            case "cdnr":
                            case "cdn":
                            case "cdnra":
                                if (tblcd == "cdnr") {
                                    tbldata = gstfile.cdnr || gstfile.cdn;
                                }

                                else {
                                    tbldata = gstfile.cdnra;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });

                                    for (var index = 0; index < tbldata.length; index++) {

                                        var subarray = {};

                                        subarray = arrayFound[0].nt;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].old_ntnum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                        }
                                        if (subArrayFound.length !== 0) {

                                            for (var fIndex = 0; fIndex < subArrayFound.length; fIndex++) {
                                                if ((((subArrayFound[fIndex].updby === "S" && subArrayFound[fIndex].cflag !== 'R') || !subArrayFound[fIndex].updby) && form === "GSTR1") || (subArrayFound[fIndex].updby === "R" && form === "GSTR2")) {
                                                    var invIndex = subarray.indexOf(subArrayFound[fIndex]);

                                                    if (subarray[invIndex]['chksum']) {
                                                        subarray[invIndex]['flag'] = "D";
                                                        msgflag = true;
                                                        if (((subarray[invIndex]['irn'] != "" && subarray[invIndex]['irn'] != undefined) || (subarray[invIndex]['srctyp'] != "" && subarray[invIndex]['srctyp'] != undefined) || (subarray[invIndex]['irngendate'] != "" && subarray[invIndex]['irngendate'] != undefined))) {
                                                            if (subarray[invIndex]['irn'])
                                                                delete subarray[invIndex]['irn'];
                                                            if (subarray[invIndex]['irngendate'])
                                                                delete subarray[invIndex]['irngendate'];
                                                            if (subarray[invIndex]['srctyp'])
                                                                delete subarray[invIndex]['srctyp'];
                                                        }
                                                    } else {
                                                        subarray.splice(invIndex, 1);
                                                    }
                                                }
                                            }


                                        }
                                    }
                                }
                                break;
                            case "cdnur":
                            case "cdnura":
                                if (tblcd == "cdnur") {
                                    tbldata = gstfile.cdnur;
                                } else {
                                    tbldata = gstfile.cdnura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {


                                    if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].old_ntnum
                                        });
                                    } else {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].nt_num
                                        });
                                    }
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);


                                        if (tbldata[index]['chksum']) {
                                            tbldata[index]['flag'] = "D";
                                            msgflag = true;
                                            if (((tbldata[index]['irn'] != "" && tbldata[index]['irn'] != undefined) || (tbldata[index]['srctyp'] != "" && tbldata[index]['srctyp'] != undefined) || (tbldata[index]['irngendate'] != "" && tbldata[index]['irngendate'] != undefined))) {
                                                if (tbldata[index]['irn'])
                                                    delete tbldata[index]['irn'];
                                                if (tbldata[index]['irngendate'])
                                                    delete tbldata[index]['irngendate'];
                                                if (tbldata[index]['srctyp'])
                                                    delete tbldata[index]['srctyp'];
                                            }
                                        } else {
                                            tbldata.splice(index, 1);
                                        }

                                    }
                                }
                                break;
                            case "nil":
                                if (form == "GSTR1") {
                                    tbldata = gstfile.nil;

                                    // delete gstfile.nil will not send nil data to portal hence portal will not get updates.

                                } else {
                                    tbldata = gstfile.nil_supplies;
                                }

                                if (!_.isEmpty(tbldata)) {

                                    if (tbldata.chksum) {

                                        tbldata.flag = 'D';
                                        if (form == 'GSTR1') {
                                            tbldata.inv = [];   //clearing the data as of now. Please comment this cond if data needs to be there after deleting...(added by pavani)
                                        }
                                    } else {

                                        tbldata = {}; // this looses reference from the actual file data.. bad idea in case everything is using pointers instead of the data itself.
                                        if (form == "GSTR1") {
                                            gstfile.nil = { "inv": [] };
                                        } else {
                                            gstfile.nil_supplies = {};
                                        }
                                    }
                                }


                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = gstfile.exp;
                                } else {
                                    tbldata = gstfile.expa;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'exp_typ': invdltArray[i].exp_typ
                                    });

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = arrayFound[0].inv;

                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);

                                            if (subarray[invIndex]['chksum']) {
                                                subarray[invIndex]['flag'] = "D";
                                                msgflag = true;
                                                if (((subarray[invIndex]['irn'] != "" && subarray[invIndex]['irn'] != undefined) || (subarray[invIndex]['srctyp'] != "" && subarray[invIndex]['srctyp'] != undefined) || (subarray[invIndex]['irngendate'] != "" && subarray[invIndex]['irngendate'] != undefined))) {
                                                    if (subarray[invIndex]['irn'])
                                                        delete subarray[invIndex]['irn'];
                                                    if (subarray[invIndex]['irngendate'])
                                                        delete subarray[invIndex]['irngendate'];
                                                    if (subarray[invIndex]['srctyp'])
                                                        delete subarray[invIndex]['srctyp'];
                                                }
                                            } else {
                                                subarray.splice(invIndex, 1);
                                            }


                                        }
                                    }
                                }
                                break;
                            case "at":
                                if (tblcd == "at") {
                                    tbldata = gstfile.at;
                                } else {
                                    tbldata = gstfile.ata;
                                }
                                if (form == 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (form == 'GSTR1') {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos
                                        });
                                    }
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        if (tbldata[index]['chksum']) {
                                            tbldata[index]['flag'] = "D";
                                        } else {
                                            tbldata.splice(index, 1);
                                        }
                                    }
                                }
                                break;
                            case "atadj":
                                tbldata = gstfile.txpd;
                                if (!tbldata)
                                    tbldata = gstfile.atadj;

                                if (form == "GSTR1") {

                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            if (tbldata[index]['chksum']) {
                                                tbldata[index]['flag'] = "D";
                                            } else {
                                                tbldata.splice(index, 1);
                                            }
                                        }
                                    }
                                } else { //for  GSTR2

                                    tbldata = gstfile.atadj;
                                    if (!tbldata)
                                        tbldata = gstfile.txpd;
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) {
                                            var index = tbldata.indexOf(arrayFound[0]);

                                            if (tbldata[index]['chksum']) {



                                                tbldata[index]['flag'] = "D";
                                            } else {
                                                tbldata.splice(index, 1);

                                            }
                                        }
                                    }
                                }



                                break;
                            case "atadja":
                            case "ata":
                                if (tblcd == "atadja") {
                                    tbldata = gstfile.txpda;
                                    if (!tbldata)
                                        tbldata = gstfile.atadja;
                                }
                                else {
                                    tbldata = gstfile.ata;
                                }

                                if (form == "GSTR1") {
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'omon': invdltArray[i].omon,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);

                                            if (tbldata[index]['chksum']) {



                                                tbldata[index]['flag'] = "D";
                                            } else {
                                                tbldata.splice(index, 1);

                                            }

                                        }
                                    }
                                } else { //for  GSTR2
                                    //ergtergter
                                    tbldata = gstfile.atadj;
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty

                                            tbldata.splice(index, 0, tbl_data[j]); //insert updated row in the same index of previous row

                                        } else {
                                            logger.log("error", "Invoice  does not exist");
                                        }
                                    }

                                }
                                break;
                            case "hsn":
                                tbldata = gstfile.hsn;


                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.data.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    var index = tbldata.data.indexOf(arrayFound[0]);


                                    if (tbldata.data[index]['chksum']) {

                                        tbldata.data[index]['flag'] = "D";
                                    } else {

                                        tbldata.data.splice(index, 1);

                                    }

                                }
                                if (tbldata.data.length == 0 && tbldata['flag']) {
                                    tbldata.flag = "D";
                                }
                                break;

                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = gstfile.b2bur;
                                } else {
                                    tbldata = gstfile.b2bura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {


                                    if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                        var arrayFound = tbldata[0].inv[i].myFind({
                                            'inum': invdltArray[i].old_inum
                                        });
                                    } else {
                                        var arrayFound = tbldata[0].inv.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                    }
                                    if (arrayFound.length == 1) {

                                        var index = tbldata[0].inv.indexOf(arrayFound[0]);





                                        if (tbldata[0].inv[index]['chksum']) {

                                            tbldata[0].inv[index]['flag'] = "D";

                                        } else {
                                            tbldata[0].inv.splice(index, 1);

                                        }



                                    }
                                }
                                break;
                            case "imp_g":
                            case "imp_ga":
                                if (tblcd == "imp_g") {
                                    tbldata = gstfile.imp_g;
                                } else {
                                    tbldata = gstfile.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);

                                        if (tbldata[index]['chksum']) {



                                            tbldata[index]['flag'] = "D";
                                        } else {
                                            tbldata.splice(index, 1);
                                        }

                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = gstfile.imp_s;

                                } else {
                                    tbldata = gstfile.imp_sa;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);


                                        if (tbldata[index]['chksum']) {
                                            tbldata[index]['flag'] = "D";
                                        } else {
                                            tbldata.splice(index, 1);
                                        }

                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    tbldata = gstfile.txi;

                                } else {
                                    tbldata = gstfile.atxi;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);

                                        if (tbldata[index]['chksum']) {

                                            tbldata[index]['flag'] = "D";

                                        } else {
                                            tbldata.splice(index, 1);

                                        }
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = gstfile.hsnsum;


                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.det.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.det.indexOf(arrayFound[0]);


                                        tbldata.det.splice(index, 1);



                                    }

                                }
                                if (tbldata.det.length == 0) {
                                    tbldata.flag = "D";
                                }
                                break;
                            case "itc_rvsl": //for  GSTR2
                                tbldata = gstfile.itc_rvsl;
                                if (!_.isEmpty(tbldata)) {
                                    if (tbldata.chksum) {
                                        tbldata.flag = 'D'
                                    } else {
                                        tbldata = {};
                                    }
                                }


                                break;

                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        if (msgflag) {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));
                            callback(null, "Document marked for delete successfully");
                        }
                        else {
                            if (type == "Upload") {
                                fs.writeFileSync(filename, JSON.stringify(gstfile));

                                callback(null, "Document marked for delete successfully")
                            } else {
                                fs.writeFileSync(filename, JSON.stringify(gstfile));
                                if (type == "Import") {
                                    callback(null, "Document deleted successfully");
                                }
                                else
                                    callback(null, "Document marked for delete successfully");

                                // 

                            }
                        }
                    }

                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While deleting the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Document marked for delete successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};
var setFlagAll = function (req, res) {
    logger.log("info", "Entering Offline File:: setFlagAll ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {


                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var fileName = req.body.returnFileName;
                var tbl_data = req.body.tbl_data;
                var dir;
                logger.log("info", "Entering Offline File:: setFlagAll with tbl_data :: %s", tbl_data);
                logger.log("info", "Entering Offline File:: setFlagAll with tblcd :: %s", tblcd);
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of unique keys to update
                var type = req.body.type;
                var filename;
                dir = uploadedImpFiledir;
                filename = dir + "/" + fileName.replace("./download", "");
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(err, null)
                    } else {
                        var gstfile = JSON.parse(data);

                        var tbldata;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = gstfile.b2b;
                                } else {
                                    tbldata = gstfile.b2ba;
                                }
                                logger.log("info", "Entering Offline File:: setFlagAll with b2b");


                                var invArr;

                                for (var index = 0; index < tbldata.length; index++) {

                                    invArr = tbldata[index].inv;

                                    for (var invIndex = 0; invIndex < invArr.length; invIndex++) {
                                        if ((((invArr[invIndex].updby === "S" && invArr[invIndex].cflag !== 'R') || !invArr[invIndex].updby) && form === "GSTR1") || (invArr[invIndex].updby === "R" && form === "GSTR2")) {


                                            if (invArr[invIndex]['chksum']) {
                                                invArr[invIndex]['flag'] = "D";
                                                if (((invArr[invIndex]['irn'] != "" && invArr[invIndex]['irn'] != undefined) || (invArr[invIndex]['srctyp'] != "" && invArr[invIndex]['srctyp'] != undefined) || (invArr[invIndex]['irngendate'] != "" && invArr[invIndex]['irngendate'] != undefined))) {
                                                    if (invArr[invIndex]['irn'])
                                                        delete invArr[invIndex]['irn'];
                                                    if (invArr[invIndex]['irngendate'])
                                                        delete invArr[invIndex]['irngendate'];
                                                    if (invArr[invIndex]['srctyp'])
                                                        delete invArr[invIndex]['srctyp'];
                                                }
                                            } else {
                                                invArr.splice(invIndex, 1);
                                            }
                                        }
                                    }
                                }
                                break;
                            case "doc_issue":
                                tbldata = gstfile.doc_issue;
                                tbldata.doc_det = [];


                                if (tbldata.doc_det.length === 0) {

                                    tbldata.flag = "D";

                                }
                                //Added by Subrat - if there are no docs in a doc_num, delete the doc_num entry
                                //This was added since it caused issue while importing the data again.
                                for (var index = 0; index < tbldata.doc_det.length; index++) {
                                    var doc_len = tbldata.doc_det[index].docs.length;

                                    if (doc_len == 0) {
                                        tbldata.doc_det.splice(index, 1);
                                        --index;
                                    }
                                }
                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    tbldata = gstfile.b2cl;
                                } else {
                                    tbldata = gstfile.b2cla;
                                }


                                logger.log("info", "Entering Offline File:: setFlagAll with b2cl");

                                var invArr;

                                for (var index = 0; index < tbldata.length; index++) {

                                    invArr = tbldata[index].inv
                                    for (var invIndex = 0; invIndex < invArr.length; invIndex++) {

                                        if (invArr[invIndex]['chksum']) {
                                            invArr[invIndex]['flag'] = "D";
                                        } else {
                                            invArr.splice(invIndex, 1);
                                        }



                                    }
                                }


                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    tbldata = gstfile.b2cs;
                                } else {
                                    tbldata = gstfile.b2csa;
                                }


                                for (var index = tbldata.length - 1; index >= 0; index--) {

                                    if (tbldata[index]['chksum']) {
                                        tbldata[index]['flag'] = "D";
                                    } else {
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "cdnr":
                            case "cdn":
                            case "cdnra":
                                if (tblcd == "cdnr") {
                                    tbldata = gstfile.cdnr || gstfile.cdn;
                                }
                                else {
                                    tbldata = gstfile.cdnra;
                                }

                                var ntArr;

                                for (var index = 0; index < tbldata.length; index++) {

                                    ntArr = tbldata[index].nt;

                                    for (var invIndex = 0; invIndex < ntArr.length; invIndex++) {
                                        if ((((ntArr[invIndex].updby === "S" && ntArr[invIndex].cflag !== 'R') || !ntArr[invIndex].updby) && form === "GSTR1") || (ntArr[invIndex].updby === "R" && form === "GSTR2")) {


                                            if (ntArr[invIndex]['chksum']) {
                                                ntArr[invIndex]['flag'] = "D";
                                                if (((ntArr[invIndex]['irn'] != "" && ntArr[invIndex]['irn'] != undefined) || (ntArr[invIndex]['srctyp'] != "" && ntArr[invIndex]['srctyp'] != undefined) || (ntArr[invIndex]['irngendate'] != "" && ntArr[invIndex]['irngendate'] != undefined))) {
                                                    if (ntArr[invIndex]['irn'])
                                                        delete ntArr[invIndex]['irn'];
                                                    if (ntArr[invIndex]['irngendate'])
                                                        delete ntArr[invIndex]['irngendate'];
                                                    if (ntArr[invIndex]['srctyp'])
                                                        delete ntArr[invIndex]['srctyp'];
                                                }
                                            } else {
                                                ntArr.splice(invIndex, 1);
                                            }
                                        }
                                    }
                                }

                                break;
                            case "cdnur":
                            case "cdnura":
                                if (tblcd == "cdnur") {
                                    tbldata = gstfile.cdnur;
                                } else {
                                    tbldata = gstfile.cdnura;
                                }

                                for (var index = 0; index < tbldata.length; index++) {




                                    if (tbldata[index]['chksum']) {
                                        tbldata[index]['flag'] = "D";
                                        if (((tbldata[index]['irn'] != "" && tbldata[index]['irn'] != undefined) || (tbldata[index]['srctyp'] != "" && tbldata[index]['srctyp'] != undefined) || (tbldata[index]['irngendate'] != "" && tbldata[index]['irngendate'] != undefined))) {
                                            if (tbldata[index]['irn'])
                                                delete tbldata[index]['irn'];
                                            if (tbldata[index]['irngendate'])
                                                delete tbldata[index]['irngendate'];
                                            if (tbldata[index]['srctyp'])
                                                delete tbldata[index]['srctyp'];
                                        }
                                    } else {
                                        tbldata.splice(index, 1);
                                    }


                                }
                                break;
                            case "nil":
                                if (form == "GSTR1") {
                                    tbldata = gstfile.nil;


                                    // delete gstfile.nil will not send nil data to portal hence portal will not get updates.

                                } else {
                                    tbldata = gstfile.nil_supplies;
                                }

                                if (!_.isEmpty(tbldata)) {

                                    if (tbldata.chksum) {

                                        tbldata.flag = 'D';
                                        if (form == 'GSTR1') {
                                            tbldata.inv = [];   //clearing the data as of now. Please comment this cond if data needs to be there after deleting...(added by pavani)
                                        }
                                    } else {

                                        tbldata = {}; // this looses reference from the actual file data.. bad idea in case everything is using pointers instead of the data itself.
                                        if (form == "GSTR1") {
                                            gstfile.nil = { "inv": [] };
                                        } else {
                                            gstfile.nil_supplies = {};
                                        }
                                    }
                                }


                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = gstfile.exp;
                                } else {
                                    tbldata = gstfile.expa;
                                }
                                var invArr;

                                for (var index = 0; index < tbldata.length; index++) {

                                    invArr = tbldata[index].inv;

                                    for (var invIndex = 0; invIndex < invArr.length; invIndex++) {



                                        if (invArr[invIndex]['chksum']) {
                                            invArr[invIndex]['flag'] = "D";
                                            if (((invArr[invIndex]['irn'] != "" && invArr[invIndex]['irn'] != undefined) || (invArr[invIndex]['srctyp'] != "" && invArr[invIndex]['srctyp'] != undefined) || (invArr[invIndex]['irngendate'] != "" && invArr[invIndex]['irngendate'] != undefined))) {
                                                if (invArr[invIndex]['irn'])
                                                    delete invArr[invIndex]['irn'];
                                                if (invArr[invIndex]['irngendate'])
                                                    delete invArr[invIndex]['irngendate'];
                                                if (invArr[invIndex]['srctyp'])
                                                    delete invArr[invIndex]['srctyp'];
                                            }
                                        } else {
                                            invArr.splice(invIndex, 1);
                                        }

                                    }
                                }
                                break;
                            case "at":
                                if (tblcd == "at") {
                                    tbldata = gstfile.at;
                                } else {
                                    tbldata = gstfile.ata;
                                }

                                for (var index = 0; index < tbldata.length; index++) {

                                    if (tbldata[index]['chksum']) {
                                        tbldata[index]['flag'] = "D";
                                    } else {
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "atadj":
                                tbldata = gstfile.txpd;
                                if (!tbldata)
                                    tbldata = gstfile.atadj;

                                for (var index = 0; index < tbldata.length; index++) {

                                    if (tbldata[index]['chksum']) {
                                        tbldata[index]['flag'] = "D";
                                    } else {
                                        tbldata.splice(index, 1);
                                    }
                                }



                                break;
                            case "atadja":
                            case "ata":
                                if (tblcd == "atadja") {
                                    tbldata = gstfile.txpda;
                                    if (!tbldata)
                                        tbldata = gstfile.atadja;
                                }
                                else {
                                    tbldata = gstfile.ata;
                                }

                                for (var index = 0; index < tbldata.length; index++) {

                                    if (tbldata[index]['chksum']) {
                                        tbldata[index]['flag'] = "D";
                                    } else {
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "hsn":
                                tbldata = gstfile.hsn;


                                for (var index = tbldata.data.length - 1; index >= 0; index--) {


                                    if (tbldata.data[index]['chksum']) {

                                        tbldata.data[index]['flag'] = "D";
                                    } else {

                                        tbldata.data.splice(index, 1);

                                    }

                                }
                                if (tbldata.data.length == 0) {
                                    tbldata.flag = "D";
                                }
                                break;

                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = gstfile.b2bur;
                                } else {
                                    tbldata = gstfile.b2bura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {



                                    if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                        var arrayFound = tbldata[0].inv[i].myFind({
                                            'inum': invdltArray[i].old_inum
                                        });
                                    } else {
                                        var arrayFound = tbldata[0].inv.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                    }
                                    if (arrayFound.length == 1) {

                                        var index = tbldata[0].inv.indexOf(arrayFound[0]);





                                        if (tbldata[0].inv[index]['chksum']) {

                                            tbldata[0].inv[index]['flag'] = "D";

                                        } else {
                                            tbldata[0].inv.splice(index, 1);

                                        }



                                    }
                                }
                                break;
                            case "imp_g":
                            case "imp_ga":
                                if (tblcd == "imp_g") {
                                    tbldata = gstfile.imp_g;
                                } else {
                                    tbldata = gstfile.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);

                                        if (tbldata[index]['chksum']) {



                                            tbldata[index]['flag'] = "D";
                                        } else {
                                            tbldata.splice(index, 1);
                                        }

                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = gstfile.imp_s;

                                } else {
                                    tbldata = gstfile.imp_sa;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);


                                        if (tbldata[index]['chksum']) {
                                            tbldata[index]['flag'] = "D";
                                        } else {
                                            tbldata.splice(index, 1);
                                        }

                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    tbldata = gstfile.txi;

                                } else {
                                    tbldata = gstfile.atxi;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);

                                        if (tbldata[index]['chksum']) {

                                            tbldata[index]['flag'] = "D";

                                        } else {
                                            tbldata.splice(index, 1);

                                        }
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = gstfile.hsnsum;


                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.det.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.det.indexOf(arrayFound[0]);


                                        tbldata.det.splice(index, 1);



                                    }

                                }
                                if (tbldata.det.length == 0) {
                                    tbldata.flag = "D";
                                }
                                break;
                            case "itc_rvsl": //for  GSTR2
                                tbldata = gstfile.itc_rvsl;
                                if (!_.isEmpty(tbldata)) {
                                    if (tbldata.chksum) {
                                        tbldata.flag = 'D'
                                    } else {
                                        tbldata = {};
                                    }
                                }


                                break;

                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        if (type == "Upload") {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document marked for delete successfully")
                        } else {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document marked for delete successfully")

                        }
                    }
                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While deleting the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Document marked for delete successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};
var deleteErrData = function (req, res) {
    logger.log("info", "Entering Offline File:: deleteErrData ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {


                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var fileName = req.body.errFileName;
                var tbl_data = req.body.tbl_data;
                var dir;

                logger.log("info", "Entering Offline File:: deleteErrData with tbl_data :: %s", tbl_data);
                logger.log("info", "Entering Offline File:: deleteErrData with tblcd :: %s", tblcd);
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of unique keys to update
                var type = req.body.type;
                var filename;
                dir = uploadedErrdir;
                filename = dir + "/" + fileName.replace("./error", "");
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(err, null)
                    } else {
                        var gstfile = JSON.parse(data);
                        var errorData = gstfile.error_report;
                        logger.log("info", " gstfile:: %s", errorData);
                        var tbldata;
                        if (form == "GSTR1" && tblcd == "hsnsum") {
                            tblcd = "hsn";
                        }
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = errorData.b2b;
                                } else {
                                    tbldata = errorData.b2ba;
                                }
                                logger.log("info", "Entering Offline File:: deleteErrData with b2b");


                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};

                                        subarray = tbldata[index].inv;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }
                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);

                                        }
                                    }
                                }
                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    tbldata = errorData.b2cl;
                                } else {
                                    tbldata = errorData.b2cla;
                                }

                                logger.log("info", "Entering Offline File:: deleteErrData with b2cl");


                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;

                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);

                                        }
                                    }
                                }


                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    tbldata = errorData.b2cs;
                                } else {
                                    tbldata = errorData.b2csa;
                                }

                                for (var k = tbldata.length - 1; k >= 0; k--) {


                                    var ukey;
                                    if (tblcd == "b2cs") {
                                        ukey = tbldata[k].pos + "_" + tbldata[k].rt + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }
                                    else {
                                        ukey = tbldata[k].omon + "_" + tbldata[k].pos + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (ukey == invdltArray[i].uni_key) {

                                            tbldata.splice(k, 1);
                                        }


                                    }

                                }
                                break;
                            case "cdnr":
                            case "cdnra":
                                if (tblcd == "cdnr") {
                                    tbldata = errorData.cdnr;
                                } else {
                                    tbldata = errorData.cdnra;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};

                                        subarray = tbldata[index].nt;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].old_ntnum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                        }
                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);

                                        }
                                    }
                                }
                                break;
                            case "cdnur":
                            case "cdnura":
                                if (tblcd == "cdnur") {
                                    tbldata = errorData.cdnur;
                                } else {
                                    tbldata = errorData.cdnura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {


                                    if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].old_ntnum
                                        });
                                    } else {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].nt_num
                                        });
                                    }
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "nil":
                                tbldata = errorData.nil;
                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = errorData.exp;
                                } else {
                                    tbldata = errorData.expa;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;

                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        if (subArrayFound.length == 1) {


                                            tbldata.splice(index, 1);


                                        }
                                    }
                                }
                                break;
                            case "at":
                                // case "ata":
                                if (tblcd == "at") {
                                    tbldata = errorData.at;
                                } else {
                                    tbldata = errorData.ata;
                                }
                                if (form == 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound;

                                    if (form == "GSTR1") {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos
                                        });
                                    }

                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "ata":
                                if (tblcd == "at") {
                                    tbldata = errorData.at;
                                } else {
                                    tbldata = errorData.ata;
                                }
                                if (form == 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound;

                                    if (form == "GSTR1") {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos
                                        });
                                    }

                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);
                                    }
                                }
                                break;
                            case "atadj":
                                tbldata = errorData.atadj;
                                if (form == "GSTR1") {
                                    tbldata = errorData.txpd;
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;

                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1);
                                        }
                                    }
                                } else { //for  GSTR2
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'i_num': invdltArray[j].i_num
                                        });
                                        if (arrayFound.length == 1) {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1);

                                            var arrayFound = tbldata.myFind({
                                                'i_num': tbl_data[j].i_num
                                            });
                                            if (arrayFound.length == 0) {
                                                tbldata.splice(index, 0, tbl_data[j]);
                                            }

                                        } else {
                                            logger.log("error", "Invoice  does not exist");
                                        }
                                    }

                                }

                                break;
                            case "atadja":

                                tbldata = errorData.atadja;

                                if (form == "GSTR1") {
                                    tbldata = errorData.txpda;
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'omon': invdltArray[i].omon,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty

                                        }
                                    }
                                } else { //for  GSTR2

                                    tbldata = gstfile.atadja;
                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) //no other case is possible.because update will be called for existing cpty only.So array found will always have a value of 1.
                                        {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            tbldata.splice(index, 1); //delete row first with matched cpty

                                            tbldata.splice(index, 0, tbl_data[j]); //insert updated row in the same index of previous row

                                        } else {
                                            logger.log("error", "Invoice  does not exist");
                                        }
                                    }

                                }
                                break;
                            case "hsn":
                                tbldata = errorData.hsn ? errorData.hsn : errorData.hsnsum;
                                for (var i = 0; i < invdltArray.length; i++) {
                                    if (!isCurrentPeriodBeforeAATOCheck(newHSNStartDateConstant, month)) {
                                        tbldata.forEach(function (row, outerIndex) {
                                            row.data.forEach(function (data, innerIndex) {
                                                if (data.hsn_sc == invdltArray[i].hsn_sc && data.desc == invdltArray[i].desc && data.uqc == invdltArray[i].uqc && data.num == invdltArray[i].num) {
                                                    tbldata[outerIndex].data.splice(innerIndex, 1);
                                                }
                                            });
                                        });
                                    }
                                    else {

                                        var arrayFound = tbldata[0].data.myFind({
                                            'num': invdltArray[i].num
                                        });

                                        if (arrayFound.length == 1) {
                                            var index = tbldata.data.indexOf(arrayFound[0]);
                                            tbldata.data.splice(index, 1);
                                        }
                                    }
                                }
                                break;

                            case "doc_issue":
                                tbldata = errorData.doc_issue;
                                var tblarray = tbldata.doc_det;
                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tblarray.myFind({ //find the doc_num
                                        'doc_num': invdltArray[i].doc_num
                                    });
                                    if (arrayFound.length != 0) {
                                        var docAry = {};
                                        docAry = arrayFound[0].docs;

                                        var subArrayFound = docAry.myFind({// find the row to delete
                                            'num': invdltArray[i].num
                                        });

                                        if (subArrayFound.length != 0) {

                                            var subIndex = docAry.indexOf(subArrayFound[0]);

                                            docAry.splice(subIndex, 1);//delete the row

                                        }
                                    }
                                }
                                for (var tbLen = 0; tbLen < tblarray.length; tbLen++) {
                                    var restAry = tblarray[tbLen].docs;
                                    for (var j = 0; j < restAry.length; j++) {

                                        restAry[j].num = j + 1;//reset the num property
                                    }
                                }
                                break;

                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = gstfile.b2bur;
                                } else {
                                    tbldata = gstfile.b2bura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata[0].inv;
                                    var subarrayFound = arrayFound.myFind({
                                        'inum': invdltArray[i].inum
                                    });

                                    if (subarrayFound.length == 1) {
                                        var index = tbldata[0].inv.indexOf(subarrayFound[0]);

                                        tbldata[0].inv.splice(index, 1);
                                        var arrayFound = tbldata[0].inv;
                                        var subarrayFound = arrayFound.myFind({
                                            'inum': tbl_data[i].inum
                                        });
                                        if (subarrayFound.length == 0) {
                                            for (var k = 0; k < tbl_data[i].inv.length; k++) {
                                                tbldata[0].inv.splice(index, 0, tbl_data[i].inv[k]);
                                            }
                                        }
                                    }
                                }
                                break;
                            case "imp_g":
                            case "imp_ga":
                                if (tblcd == "imp_g") {
                                    tbldata = gstfile.imp_g;
                                } else {
                                    tbldata = gstfile.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);

                                        var arrayFound = tbldata.myFind({
                                            'boe_num': tbl_data[i].boe_num
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }

                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = gstfile.imp_s;

                                } else {
                                    tbldata = gstfile.imp_sa;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'i_num': invdltArray[i].i_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);

                                        var arrayFound = tbldata.myFind({
                                            'i_num': tbl_data[i].i_num
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }

                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    tbldata = gstfile.txi;

                                } else {
                                    tbldata = gstfile.atxi;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'dnum': invdltArray[i].dnum
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);

                                        var arrayFound = tbldata.myFind({
                                            'dnum': tbl_data[i].dnum
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }

                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = errorData.hsnsum;


                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.det.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.det.indexOf(arrayFound[0]);
                                        tbldata.det.splice(index, 1);


                                    }
                                }
                                break;

                            case "itc_rvsl": //for  GSTR2
                                tbldata = gstfile.itc_rvsl;
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inv_doc_num': invdltArray[i].inv_doc_num
                                    });
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        tbldata.splice(index, 1);

                                        var arrayFound = tbldata.myFind({
                                            'inv_doc_num': tbl_data[i].inv_doc_num
                                        });
                                        if (arrayFound.length == 0) {
                                            tbldata.splice(index, 0, tbl_data[i]);
                                        }

                                    } else {
                                        logger.log("error", "Invoice  does not exist");
                                    }
                                }
                                break;
                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        if (type == "Upload") {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Return document deleted successfully")
                        } else {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Return document deleted successfully")

                        }
                    }
                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While deleting the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return document deleted successfully:: %s", result);

                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while deleting the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};
var updateImport = function (req, res) {
    logger.log("info", "Entering Offline File:: setFlagAll ");
    var errorObject = null;
    try {
        async.waterfall([
            function (callback) {


                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var fileName = req.body.returnFileName;
                var tbl_data = req.body.tbl_data;
                var dir;
                logger.log("info", "Entering Offline File:: updateImport with tbl_data :: %s", tbl_data);
                logger.log("info", "Entering Offline File:: updateImport with tblcd :: %s", tblcd);
                var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of unique keys to update
                var type = req.body.type;
                var filename;
                dir = uploadedImpFiledir;
                filename = dir + "/" + fileName.replace("./download", "");
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(err, null)
                    } else {
                        var gstfile = JSON.parse(data);

                        var tbldata;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    tbldata = gstfile.b2b;
                                } else {
                                    tbldata = gstfile.b2ba;
                                }
                                logger.log("info", "Entering Offline File:: updateImport with b2b");

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });

                                    for (var index = 0; index < tbldata.length; index++) {

                                        var subarray = {};

                                        subarray = arrayFound[0].inv;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_inum && invdltArray[i].old_inum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].old_inum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'inum': invdltArray[i].inum
                                            });
                                        }
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);

                                            if (subarray[invIndex]['flag']) {
                                                subarray[invIndex] = tbl_data[0].inv[0];

                                                subarray[invIndex]['flag'] = "E";



                                            } else {

                                                subarray[invIndex] = tbl_data[0].inv[0];
                                            }



                                        }
                                    }
                                }
                                break;

                            case "doc_issue":
                                tbldata = gstfile.doc_issue;
                                if (tbldata['flag']) {
                                    delete tbldata['flag'];
                                }


                                var tblarray = tbldata.doc_det;

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tblarray.myFind({
                                        'doc_num': invdltArray[0].doc_num
                                    });

                                    if (arrayFound.length != 0) { // if doc_num already exists
                                        var docAry = {};
                                        docAry = arrayFound[0].docs;
                                        for (var inputRow = 0; inputRow < invdltArray[0].docs.length; inputRow++) {
                                            var subArrayFound = docAry.myFind({
                                                'num': invdltArray[0].docs[inputRow].num
                                            });

                                            if (subArrayFound.length != 0) {

                                                var subIndex = docAry.indexOf(subArrayFound[0]);
                                                docAry.splice(subIndex, 1);
                                                docAry.splice(subIndex, 0, invdltArray[0].docs[inputRow])

                                            }
                                            else {
                                                docAry.push(invdltArray[0].docs[inputRow]);
                                            }

                                        }

                                    }
                                    else //if doc_num does not exist
                                    {

                                        tblarray.push(invdltArray[i]);
                                    }



                                }
                                break;

                            case "b2cl":

                                tbldata = gstfile.b2cl;


                                logger.log("info", "Entering Offline File:: updateImport with b2cl");


                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;

                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);



                                            if (subarray[invIndex]['chksum']) {
                                                subarray[invIndex] = tbl_data[0].inv[0];

                                                //subarray[invIndex]['flag'] = "M";
                                                subarray[invIndex]['flag'] = "E";
                                            } else {
                                                subarray[invIndex] = tbl_data[0].inv[0];
                                            }


                                        }
                                    }
                                }


                                break;



                            case "b2cla":

                                tbldata = gstfile.b2cla;


                                logger.log("info", "Entering Offline File:: updateImport with b2cl");


                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;

                                        var subArrayFound = subarray.myFind({
                                            'oinum': invdltArray[i].oinum
                                        });
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);



                                            if (subarray[invIndex]['chksum']) {
                                                subarray[invIndex] = tbl_data[0].inv[0];

                                                subarray[invIndex]['flag'] = "E";
                                            } else {
                                                subarray[invIndex] = tbl_data[0].inv[0];
                                            }


                                        }
                                    }
                                }


                                break;


                            case "b2cs":
                            case "b2csa":
                                var ukey;//ukey changes added by Subrat due to change in b2csa schema
                                if (tblcd == "b2cs") {
                                    tbldata = gstfile.b2cs;
                                } else {
                                    tbldata = gstfile.b2csa;
                                }
                                for (var k = tbldata.length - 1; k >= 0; k--) {
                                    if (tblcd == "b2cs") {
                                        ukey = tbldata[k].pos + "_" + tbldata[k].rt + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    } else {
                                        ukey = tbldata[k].omon + "_" + tbldata[k].pos + "_" + tbldata[k].diff_percent + "_" + tbldata[k].etin;
                                    }

                                    for (var i = 0; i < invdltArray.length; i++) {



                                        if (ukey == invdltArray[i].uni_key) {

                                            if (tbldata[k]['chksum']) {
                                                tbldata[k] = tbl_data[0];
                                                tbldata[k]['flag'] = "E";
                                            } else {
                                                tbldata[k] = tbl_data[0];
                                            }


                                        }


                                    }

                                }
                                break;
                            case "cdnr":
                            case "cdnra":
                                if (tblcd == "cdnr") {
                                    tbldata = gstfile.cdnr || gstfile.cdn;
                                } else {
                                    tbldata = gstfile.cdnra;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'ctin': invdltArray[i].ctin
                                    });

                                    for (var index = 0; index < tbldata.length; index++) {

                                        var subarray = {};

                                        subarray = arrayFound[0].nt;

                                        if (!subarray)
                                            subarray = [];
                                        if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].old_ntnum
                                            });
                                        } else {
                                            var subArrayFound = subarray.myFind({
                                                'nt_num': invdltArray[i].nt_num
                                            });
                                        }
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);

                                            if (subarray[invIndex]['flag']) {
                                                subarray[invIndex] = tbl_data[0].nt[0];
                                                subarray[invIndex]['flag'] = "E";

                                            } else {

                                                subarray[invIndex] = tbl_data[0].nt[0];
                                            }



                                        }
                                    }
                                }
                                break;
                            case "cdnur":
                            case "cdnura":
                                if (tblcd == "cdnur")
                                    tbldata = gstfile.cdnur;
                                else
                                    tbldata = gstfile.cdnura;

                                for (var i = 0; i < invdltArray.length; i++) {


                                    if (invdltArray[i].old_ntnum && invdltArray[i].old_ntnum != '') {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].old_ntnum
                                        });
                                    } else {
                                        var arrayFound = tbldata.myFind({
                                            'nt_num': invdltArray[i].nt_num
                                        });
                                    }
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);

                                        if (tbldata[index]['chksum']) {
                                            tbldata[index] = tbl_data[0];

                                            tbldata[index]['flag'] = "E";

                                        } else {
                                            tbldata[index] = tbl_data[0];
                                        }

                                    }
                                }
                                break;
                            case "nil":
                                if (form == "GSTR1") {
                                    tbldata = gstfile.nil;
                                } else {
                                    if (!_.isEmpty(tbldata)) {
                                        if (tbldata.chksum) {
                                            tbldata = tbl_data;
                                            tbldata.flag = 'E'
                                        } else {
                                            tbldata = tbl_data;;
                                        }
                                    }
                                }
                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    tbldata = gstfile.exp;
                                } else {
                                    tbldata = gstfile.expa;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    for (var index = 0; index < tbldata.length; index++) {


                                        var subarray = {};
                                        subarray = tbldata[index].inv;

                                        var subArrayFound = subarray.myFind({
                                            'inum': invdltArray[i].inum
                                        });
                                        if (subArrayFound.length == 1) {

                                            var invIndex = subarray.indexOf(subArrayFound[0]);

                                            if (subarray[invIndex]['chksum']) {

                                                subarray[invIndex] = tbl_data[0].inv[0];

                                                subarray[invIndex]['flag'] = "E";
                                            } else {
                                                subarray[invIndex] = tbl_data[0].inv[0];
                                            }


                                        }
                                    }
                                }
                                break;
                            case "at":
                            case "ata":
                                if (tblcd == "at") {
                                    tbldata = gstfile.at;
                                } else {
                                    tbldata = gstfile.ata;
                                }
                                if (form = 'GSTR1')
                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound;
                                    if (form == "GSTR1") {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                    } else {
                                        arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos
                                        });
                                    }
                                    if (arrayFound.length == 1) {
                                        var index = tbldata.indexOf(arrayFound[0]);
                                        if (tbldata[index]['chksum']) {
                                            tbldata[index] = tbl_data[0];

                                            tbldata[index]['flag'] = "E";
                                        } else {
                                            tbldata[index] = tbl_data[0];
                                        }
                                    }
                                }
                                break;
                            case "atadj":
                            case "atadja":
                            case "txpda":
                                if (gstfile.txpd) {
                                    tbldata = gstfile.txpd;
                                } else if (gstfile.atadj) {
                                    tbldata = gstfile.atadj;
                                }
                                tbldata = gstfile.txpd;
                                if (tblcd == 'atadja' || tblcd == 'txpda')
                                    tbldata = gstfile.txpda;

                                if (form == "GSTR1") {

                                    for (var j = 0; j < tbldata.length; j++) {
                                        if (!tbldata[j].diff_percent)
                                            tbldata[j].diff_percent = null;
                                    }
                                    for (var i = 0; i < invdltArray.length; i++) {
                                        if (!invdltArray[i].diff_percent)
                                            invdltArray[i].diff_percent = null;
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[i].pos,
                                            'diff_percent': invdltArray[i].diff_percent
                                        });
                                        if (arrayFound.length == 1) {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            if (tbldata[index]['chksum']) {
                                                tbldata[index] = tbl_data[0];

                                                tbldata[index]['flag'] = "E";
                                            } else {
                                                tbldata[index] = tbl_data[0];
                                            }
                                        }
                                    }
                                } else { //for  GSTR2

                                    for (var j = 0; j < invdltArray.length; j++) {
                                        var arrayFound = tbldata.myFind({
                                            'pos': invdltArray[j].pos
                                        });
                                        if (arrayFound.length == 1) {
                                            var index = tbldata.indexOf(arrayFound[0]);
                                            if (tbldata[index]['chksum']) {
                                                tbldata[index] = tbl_data[0];
                                                tbldata[index]['flag'] = "E";
                                            } else {
                                                tbldata[index] = tbl_data[0];
                                            }

                                        }

                                    }
                                }

                                break;
                            case "hsn":
                                tbldata = gstfile.hsn;

                                // if (tbldata['flag']) {
                                //     delete tbldata['flag'];
                                // }
                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.data.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.data.indexOf(arrayFound[0]);
                                        if (tbldata.data[index]['chksum']) {
                                            tbldata.data[index] = tbl_data[0].data[0];

                                            tbldata.data[index]['flag'] = "E";
                                        } else {
                                            tbldata.data[index] = tbl_data[0].data[0];
                                        }

                                    }
                                }
                                break;

                            case "b2bur":
                            case "b2bura":
                                if (tblcd == "b2bur") {
                                    tbldata = gstfile.b2bur;
                                } else {
                                    tbldata = gstfile.b2bura;
                                }

                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata[0].inv;
                                    var subarrayFound = arrayFound.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (subarrayFound.length == 1) {

                                        var index = tbldata[0].inv.indexOf(subarrayFound[0]);
                                        if (tbldata[0].inv[index]['chksum']) {
                                            tbldata[0].inv[index] = tbl_data[0].inv[0];
                                            tbldata[0].inv[index]['flag'] = "E";
                                        } else {
                                            tbldata[0].inv[index] = tbl_data[0].inv[0];
                                        }
                                    }


                                }
                                break;
                            case "imp_g":
                            case "imp_ga":
                                if (tblcd == "imp_g") {
                                    tbldata = gstfile.imp_g;
                                } else {
                                    tbldata = gstfile.imp_ga;
                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'boe_num': invdltArray[i].boe_num
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);
                                        if (tbldata[index]['chksum']) {
                                            tbldata[index] = tbl_data[0];
                                            tbldata[index]['flag'] = "E";
                                        } else {
                                            tbldata[index] = tbl_data[0];
                                        }
                                    }
                                }
                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    tbldata = gstfile.imp_s;

                                } else {
                                    tbldata = gstfile.imp_sa;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'inum': invdltArray[i].inum
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);
                                        if (tbldata[index]['chksum']) {
                                            tbldata[index] = tbl_data[0];
                                            tbldata[index]['flag'] = "E";
                                        } else {
                                            tbldata[index] = tbl_data[0];
                                        }
                                    }

                                }
                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    tbldata = gstfile.txi;

                                } else {
                                    tbldata = gstfile.atxi;

                                }
                                for (var i = 0; i < invdltArray.length; i++) {
                                    var arrayFound = tbldata.myFind({
                                        'pos': invdltArray[i].pos
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.indexOf(arrayFound[0]);
                                        if (tbldata[index]['chksum']) {
                                            tbldata[index] = tbl_data[0];
                                            tbldata[index]['flag'] = "E";
                                        } else {
                                            tbldata[index] = tbl_data[0];
                                        }
                                    }
                                }
                                break;
                            case "hsnsum": //for  GSTR2
                                tbldata = gstfile.hsnsum;


                                for (var i = 0; i < invdltArray.length; i++) {

                                    var arrayFound = tbldata.det.myFind({
                                        'num': invdltArray[i].num
                                    });
                                    if (arrayFound.length == 1) {

                                        var index = tbldata.det.indexOf(arrayFound[0]);
                                        if (tbldata.det[index]['chksum']) {
                                            tbldata.det[index] = tbl_data[0].det[0];
                                            tbldata.det[index]['flag'] = "E";
                                        } else {
                                            tbldata.det[index] = tbl_data[0].det[0];
                                        }

                                    }
                                }
                                break;
                            case "itc_rvsl": //for  GSTR2
                                tbldata = gstfile.itc_rvsl;
                                if (!_.isEmpty(tbldata)) {
                                    if (tbldata.chksum) {
                                        tbldata = tbl_data;
                                        tbldata.flag = 'E'
                                    } else {
                                        tbldata = tbl_data;;
                                    }
                                }

                                break;
                            case "nil_supplies": //for  GSTR2
                                tbldata = gstfile.nil_supplies;
                                if (!_.isEmpty(tbldata)) {
                                    if (tbldata.chksum) {
                                        tbldata = tbl_data;
                                        tbldata.flag = 'E'
                                    } else {
                                        tbldata = tbl_data;;
                                    }
                                }
                                break;
                            default:
                                tbldata = gstfile.hsnSac;
                        }
                        if (type == "Upload") {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document updated successfully")
                        } else {
                            fs.writeFileSync(filename, JSON.stringify(gstfile));

                            callback(null, "Document updated successfully")

                        }
                    }
                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While updating the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Document updated successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};

var clearSectionData = function (req, res) {
    logger.log("info", "Entering Offline File:: clearSectionData ");
    var errorObject = null;
    try {
        async.waterfall([

            function (callback) {
                var gstin = req.body.gstin;
                var form = req.body.form;
                var fy = req.body.fy;
                var month = req.body.month;
                var tblcd = req.body.tbl_cd;
                var type = req.body.type;
                var impFile = req.body.returnFileName;
                var dir, filename;
                if (type == "Import") {
                    /*dir = uploadedFiledir + gstin + "_" + form + "_" + fy + "_" + month;
                    filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';*/
                    var dir = uploadedImpFiledir;
                    filename = dir + "/" + impFile.replace("./download", "")
                } else {
                    var dir = controlFiledir + gstin + "/" + form + "/" + fy + "/" + month;
                    filename = dir + "/" + form + '_' + gstin + '_' + fy + '_' + month + '.json';
                }

                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {
                        callback("No records available for delete.", null)

                    } else {
                        var gstfile = JSON.parse(data);
                        var tbldata;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                if (tblcd == "b2b") {
                                    gstfile.b2b = [];
                                } else {
                                    gstfile.b2ba = [];
                                }



                                break;
                            case "doc_issue":

                                gstfile.doc_issue = { "doc_det": [] };

                                break;
                            case "b2cl":
                            case "b2cla":
                                if (tblcd == "b2cl") {
                                    gstfile.b2cl = [];
                                } else {
                                    gstfile.b2cla = [];
                                }


                                break;
                            case "b2cs":
                            case "b2csa":
                                if (tblcd == "b2cs") {
                                    gstfile.b2cs = [];
                                } else {
                                    gstfile.b2csa = [];
                                }

                                tbldata = [];
                                break;
                            case "cdnr":
                            case "cdnra":

                                if (tblcd == "cdnr") {

                                    gstfile.cdnr = [];
                                    gstfile.cdn = [];

                                } else {
                                    gstfile.cdnra = [];
                                }

                                break;
                            case "cdnur":
                            case "cdnura":
                                if (tblcd == "cdnur") {
                                    gstfile.cdnur = [];
                                } else {
                                    gstfile.cdnura = [];
                                }


                                break;
                            case "nil":
                                if (form == 'GSTR1')
                                    gstfile.nil = { "inv": [] };
                                else
                                    gstfile.nil_supplies = {};

                                break;
                            case "exp":
                            case "expa":
                                if (tblcd == "exp") {
                                    gstfile.exp = [];
                                } else {
                                    gstfile.expa = [];
                                }
                                break;
                            case "at":
                            case "ata":
                            case "txi":
                            case "txia":
                                if (tblcd == "at") {
                                    gstfile.at = [];
                                } else if (tblcd == 'ata') {
                                    gstfile.ata = [];
                                } else if (tblcd == 'txi') {
                                    gstfile.txi = [];
                                } else if (tblcd == 'txia') {
                                    gstfile.txia = [];
                                }

                                break;
                            case "atadj":

                                if (gstfile.txpd)
                                    gstfile.txpd = [];
                                if (gstfile.atadj)
                                    gstfile.atadj = [];

                                break;
                            case "atadja":
                                gstfile.atadja = [];
                                break;
                            case "hsn":
                                if (gstfile.hsn.flag) {
                                    gstfile.hsn.flag = "D";
                                }
                                gstfile.hsn.data = [];
                                break;

                            case "b2bur":
                            case "b2bura":
                                var newB2bur = [];
                                newB2bur.push({});
                                newB2bur[0].inv = [];
                                if (tblcd == "b2bur") {
                                    gstfile.b2bur = newB2bur;
                                } else {
                                    gstfile.b2bura = newB2bur;
                                }


                                break;
                            case "imp_g": //for  GSTR2
                            case "imp_ga": //for  GSTR2
                                if (tblcd == "imp_g") {
                                    gstfile.imp_g = [];

                                } else {
                                    gstfile.imp_ga = [];

                                }

                                break;
                            case "imp_s": //for  GSTR2
                            case "imp_sa": //for  GSTR2
                                if (tblcd == "imp_s") {
                                    gstfile.imp_s = [];

                                } else {
                                    gstfile.imp_sa = [];

                                }

                                break;
                            case "txi": //for  GSTR2
                            case "atxi": //for  GSTR2
                                if (tblcd == "txi") {
                                    gstfile.txi = [];

                                } else {
                                    gstfile.atxi = [];

                                }

                                break;
                            case "hsnsum": //for  GSTR2
                                var newhsnsum = {};
                                newhsnsum.det = []
                                gstfile.hsnsum = newhsnsum;


                                break;

                            case "itc_rvsl": //for  GSTR2
                                gstfile.itc_rvsl = [];

                                break;
                            case "impg":
                                gstfile.impg = [];
                                break;
                            case "impgsez":
                                gstfile.impgsez = [];
                                break;
                            case "isd":
                                gstfile.isd = [];
                                break;
                            case "isda":
                                gstfile.isda = [];
                                break;
                            default:
                                gstfile.hsnSac = [];
                        }
                        fs.writeFileSync(filename, JSON.stringify(gstfile));
                        callback(null, "Records of the selected section have been removed from the tool successfully!")
                    }

                });

            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: 404,
                    errorCd: err,
                };
                logger.log("error", "Error While deleting the files :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Invoices deleted successfully :: %s", result);
                response.success(result, res)
            }
        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while deleting the invoices:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }
};

var addmltplerrdata = function (req, res) {
    var myCache = req.app.get('myCache');
    logger.log("info", "Entering Offline File:: addmltplerrdata ");
    var errorObject = null;
    try {
        var gstin = req.body.gstin;
        var form = req.body.form;
        var gt = req.body.gt;
        var cur_gt = req.body.cur_gt;
        var fp = req.body.fp;
        var fy = req.body.fy;
        var month = req.body.month;
        var dataObj = req.body.tbl_data;
        var jsonObj = [];
        var type = req.body.type;
        var dir, isSameGSTIN, filename;
        var errFileName = req.body.errFileName;

        async.waterfall([
            function (callback) {
                logger.log("info", "entered in async.waterfall function 0, checking for data-cache");
                if (dataObj.cache_key != undefined) {
                    myCache.get(dataObj.cache_key, function (err, value) {
                        if (!err) {
                            if (value == undefined) {
                                logger.log("warning", "cache key found, but not the data, something wrong, abort");
                                callback('uanble to fetch key', null);
                            } else {
                                dataObj = value; // no need to pass dataObj, its in function scope.
                                callback(null)
                            }
                        } else {
                            logger.log("warning", "cache key found, but unable to get the data, something wrong, abort");
                            callback(err, null)
                        }
                    });

                } else {
                    // cache key not found in payload, proceed with normal payload.
                    callback(null)
                }
            },
            function (callback) {
                logger.log("info", "entered in async.waterfall function 1");
                common.formDataFormat(req, function (formDataFormat) {
                    logger.log("info", "entered in async.waterfall formDataFormat");

                    callback(null, formDataFormat)
                })
            },

            function (formDataFormat, callback) {
                dir = uploadedErrdir;
                filename = dir + errFileName.replace("./error/", "");

                fs.readFile(filename, 'utf8', function (err, data) { // 1. read the file 2.Create file if not exist.  3.Append data if exist
                    if (err) //1. error reading the file
                    {
                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(err, null)

                    } else // If file is there.
                    {

                        var gstfile = JSON.parse(data);

                        var errorData = gstfile.error_report;
                        var tbldata;

                        for (var k = 0; k < dataObj.length; k++) {
                            //console.log(dataObj[k]);
                            var secData = dataObj[k];
                            //Inorder to bypass the if condition in case of second flow for mentioned sections need to check the data. if data not exists thn we need to set flag as D.
                            var isFirstFlowImport = true; //default true for first flow -- added by pavani
                            if (type && type == 'Import') {
                                if (secData.cd == 'nil' || secData.cd == 'doc_issue' || secData.cd == 'hsn')
                                    isFirstFlowImport = false; //dafault true for second flow except these sections
                            }
                            if (!secData.dt[0] && isFirstFlowImport) {

                                logger.log("info", "data is not there so no need to add empty array");
                            } else {

                                switch (secData.cd) {

                                    case "b2b":

                                        tbldata = errorData.b2b;

                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (gstin == secData.dt[i].ctin || gstin == secData.dt[i].inv[0].etin) {
                                                isSameGSTIN = gstin;
                                            } else {

                                                if (secData.dt[i].inv[0].ref_key) {
                                                    var refKey = secData.dt[i].inv[0].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldCtin = refKeyParts[0],
                                                        old_inum = refKeyParts[1];
                                                    delete secData.dt[i].inv[0].ref_key;
                                                }
                                                if (oldCtin && old_inum) {
                                                    keyObj.oldCtin = oldCtin;
                                                    keyObj.old_inum = old_inum;
                                                }

                                                responseinvce.push(keyObj);

                                                var arrayFound = tbldata.myFind({
                                                    'ctin': responseinvce[0].oldCtin
                                                });


                                                if (arrayFound.length) {
                                                    for (var j = 0; j < arrayFound.length; j++) {

                                                        var subarray = {};
                                                        subarray = arrayFound[j].inv;

                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].old_inum
                                                        });


                                                        if (subArrayFound.length == 1) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);
                                                        }
                                                    }

                                                }
                                            }
                                        }
                                        break;
                                    case "b2ba":

                                        tbldata = errorData.b2ba;

                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (gstin == secData.dt[i].ctin || gstin == secData.dt[i].inv[0].etin) {
                                                isSameGSTIN = gstin;
                                            } else {

                                                if (secData.dt[i].inv[0].ref_key) {
                                                    var refKey = secData.dt[i].inv[0].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldCtin = refKeyParts[0],
                                                        old_oinum = refKeyParts[1],
                                                        old_inum = refKeyParts[2];
                                                    delete secData.dt[i].inv[0].ref_key;
                                                }
                                                if (oldCtin && old_oinum && old_inum) {
                                                    keyObj.oldCtin = oldCtin;
                                                    keyObj.old_oinum = old_oinum;
                                                    keyObj.old_inum = old_inum;
                                                }

                                                responseinvce.push(keyObj);

                                                var arrayFound = tbldata.myFind({
                                                    'ctin': responseinvce[0].oldCtin
                                                });


                                                if (arrayFound.length) {
                                                    for (var j = 0; j < arrayFound.length; j++) {

                                                        var subarray = {};
                                                        subarray = arrayFound[j].inv;

                                                        var subArrayFound = subarray.myFind({
                                                            'oinum': responseinvce[0].old_oinum,
                                                            'inum': responseinvce[0].old_inum
                                                        });


                                                        if (subArrayFound.length == 1) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);
                                                        }
                                                    }

                                                }
                                            }
                                        }
                                        break;
                                    case "doc_issue":
                                        tbldata = errorData.doc_issue;

                                        var uniKeyAry = [];  // array to store unique key property
                                        var keyObj = {};

                                        var tblarray = tbldata.doc_det;

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            keyObj.doc_num = secData.dt[i].doc_num;


                                            uniKeyAry.push(keyObj);


                                            var arrayFound = tblarray.myFind({
                                                'doc_num': uniKeyAry[0].doc_num
                                            });

                                            if (arrayFound.length != 0) { // if doc_num already exists

                                                var docAry = {};
                                                docAry = arrayFound[0].docs;
                                                for (var inputRow = 0; inputRow < secData.dt[i].docs.length; inputRow++) {
                                                    var subArrayFound = docAry.myFind({
                                                        'num': secData.dt[i].docs[inputRow].num
                                                    });

                                                    if (subArrayFound.length != 0) {
                                                        var subIndex = docAry.indexOf(subArrayFound[0]);
                                                        docAry.splice(subIndex, 1);
                                                        docAry.splice(subIndex, 0, secData.dt[i].docs[inputRow]);

                                                    }

                                                }

                                            }
                                        }
                                        break;
                                    case "b2cl":


                                        tbldata = errorData.b2cl;

                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (gstin == secData.dt[i].inv[0].etin) {
                                                isSameGSTIN = gstin;
                                            } else {

                                                if (secData.dt[i].inv[0].ref_key) {
                                                    var refKey = secData.dt[i].inv[0].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldPOS = refKeyParts[0],
                                                        old_inum = refKeyParts[1];
                                                    delete secData.dt[i].inv[0].ref_key;
                                                }

                                                if (oldPOS && old_inum) {
                                                    keyObj.oldPOS = oldPOS;
                                                    keyObj.old_inum = old_inum;
                                                }

                                                responseinvce.push(keyObj);

                                                var arrayFound = tbldata.myFind({
                                                    'pos': responseinvce[0].oldPOS
                                                });


                                                if (arrayFound.length) {
                                                    for (var j = 0; j < arrayFound.length; j++) {

                                                        var subarray = {};
                                                        subarray = arrayFound[j].inv;

                                                        var subArrayFound = subarray.myFind({
                                                            'inum': responseinvce[0].old_inum
                                                        });

                                                        if (subArrayFound.length == 1) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);
                                                        }
                                                    }

                                                }
                                            }
                                        }
                                        break;

                                    case "b2cla":

                                        tbldata = errorData.b2cla;


                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (gstin == secData.dt[i].inv[0].etin) {
                                                isSameGSTIN = gstin;
                                            } else {

                                                if (secData.dt[i].inv[0].ref_key) {
                                                    var refKey = secData.dt[i].inv[0].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldPOS = refKeyParts[0],
                                                        old_oinum = refKeyParts[1],
                                                        old_inum = refKeyParts[2];
                                                    delete secData.dt[i].inv[0].ref_key;
                                                }

                                                if (oldPOS && old_inum && old_oinum) {
                                                    keyObj.oldPOS = oldPOS;
                                                    keyObj.old_oinum = old_oinum;
                                                    keyObj.old_inum = old_inum;
                                                }

                                                responseinvce.push(keyObj);

                                                var arrayFound = tbldata.myFind({
                                                    'pos': responseinvce[0].oldPOS
                                                });


                                                if (arrayFound.length) {
                                                    for (var j = 0; j < arrayFound.length; j++) {

                                                        var subarray = {};
                                                        subarray = arrayFound[j].inv;

                                                        var subArrayFound = subarray.myFind({
                                                            'oinum': responseinvce[0].old_oinum,
                                                            'inum': responseinvce[0].old_inum
                                                        });

                                                        if (subArrayFound.length == 1) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);
                                                        }
                                                    }

                                                }
                                            }
                                        }
                                        break;


                                    case "b2cs":
                                        tbldata = errorData.b2cs;
                                        for (var i = 0; i < secData.dt.length; i++) {
                                            if (gstin == secData.dt[i].etin) {
                                                isSameGSTIN = gstin;
                                            } else {
                                                if (secData.dt[i].ref_key) {
                                                    var refKey = secData.dt[i].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldPos = refKeyParts[0],
                                                        oldRate = Number(refKeyParts[1]),
                                                        oldEtin = refKeyParts[2],
                                                        old_diffprcnt = Number(refKeyParts[3]);
                                                    delete secData.dt[i].ref_key;
                                                }
                                                for (var j = 0; j < tbldata.length; j++) {
                                                    if (!tbldata[j].diff_percent) {
                                                        tbldata[j].diff_percent = "";
                                                    }
                                                    if (!tbldata[j].etin) {
                                                        tbldata[j].etin = "";
                                                    }

                                                    if (tbldata[j].pos === oldPos) {
                                                        if (tbldata[j].rt === oldRate) {
                                                            if (tbldata[j].etin === oldEtin) {
                                                                if (tbldata[j].diff_percent === old_diffprcnt) {
                                                                    tbldata.splice(j, 1);
                                                                    tbldata.splice(j, 0, secData.dt[i]);
                                                                    jsonObj.push(secData.cd + ":" + secData.dt[i].pos + "_" + secData.dt[i].rt + "_" + secData.dt[i].typ);
                                                                }
                                                            }

                                                        }
                                                    }
                                                }

                                            }
                                        }

                                        break;
                                    case "b2csa":

                                        tbldata = errorData.b2csa;

                                        for (var i = 0; i < secData.dt.length; i++) {
                                            if (gstin == secData.dt[i].etin) {
                                                isSameGSTIN = gstin;
                                            } else {
                                                if (secData.dt[i].ref_key) {
                                                    var refKey = secData.dt[i].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldPos = refKeyParts[0],
                                                        oldOmon = refKeyParts[1],
                                                        old_diffprcnt = refKeyParts[2];
                                                    delete secData.dt[i].ref_key;
                                                }
                                                for (var j = 0; j < tbldata.length; j++) {
                                                    if (!tbldata[j].diff_percent) {
                                                        tbldata[j].diff_percent = "";
                                                    }

                                                    if (tbldata[j].pos === oldPos) {
                                                        if (tbldata[j].omon === oldOmon) {
                                                            if (tbldata[j].diff_percent === old_diffprcnt) {
                                                                tbldata.splice(j, 1);
                                                                tbldata.splice(j, 0, secData.dt[i]);
                                                                jsonObj.push(secData.cd + ":" + secData.dt[i].pos + "_" + secData.dt[i].omon);

                                                            }

                                                        }
                                                    }
                                                }

                                            }
                                        }
                                        break;

                                    case "cdnr":

                                        tbldata = errorData.cdnr;

                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (gstin == secData.dt[i].ctin) {
                                                isSameGSTIN = gstin;
                                            } else {

                                                if (secData.dt[i].nt[0].ref_key) {
                                                    var refKey = secData.dt[i].nt[0].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldCtin = refKeyParts[0],
                                                        old_ntnum = refKeyParts[1];
                                                    delete secData.dt[i].nt[0].ref_key;
                                                }
                                                if (oldCtin && old_ntnum) {
                                                    keyObj.oldCtin = oldCtin;
                                                    keyObj.old_ntnum = old_ntnum;
                                                }

                                                responseinvce.push(keyObj);

                                                var arrayFound = tbldata.myFind({
                                                    'ctin': responseinvce[0].oldCtin //first time going with original ctin..
                                                });

                                                if (arrayFound.length) {
                                                    for (var j = 0; j < arrayFound.length; j++) {

                                                        var subarray = {};
                                                        subarray = arrayFound[j].nt;

                                                        var subArrayFound = subarray.myFind({
                                                            'nt_num': responseinvce[0].old_ntnum
                                                        });

                                                        if (subArrayFound.length == 1) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].nt[0].nt_num);
                                                        }
                                                    }

                                                }
                                            }
                                        }

                                        break;
                                    case "cdnra":

                                        tbldata = errorData.cdnra;


                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (gstin == secData.dt[i].ctin) {
                                                isSameGSTIN = gstin;
                                            } else {

                                                if (secData.dt[i].nt[0].ref_key) {
                                                    var refKey = secData.dt[i].nt[0].ref_key,
                                                        refKeyParts = refKey.split('_'),
                                                        oldCtin = refKeyParts[0],
                                                        old_ontnum = refKeyParts[1],
                                                        old_ntnum = refKeyParts[2];
                                                    delete secData.dt[i].nt[0].ref_key;
                                                }
                                                if (oldCtin && old_ntnum && old_ontnum) {
                                                    keyObj.oldCtin = oldCtin;
                                                    keyObj.old_ntnum = old_ntnum;
                                                    keyObj.old_ontnum = old_ontnum;

                                                }

                                                responseinvce.push(keyObj);

                                                var arrayFound = tbldata.myFind({
                                                    'ctin': responseinvce[0].oldCtin //first time going with original ctin..
                                                });

                                                if (arrayFound.length) {
                                                    for (var j = 0; j < arrayFound.length; j++) {

                                                        var subarray = {};
                                                        subarray = arrayFound[j].nt;

                                                        var subArrayFound = subarray.myFind({
                                                            'ont_num': responseinvce[0].old_ontnum,
                                                            'nt_num': responseinvce[0].old_ntnum
                                                        });

                                                        if (subArrayFound.length == 1) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].nt[0].nt_num);
                                                        }
                                                    }

                                                }
                                            }
                                        }

                                        break;
                                    case "cdnur":

                                        tbldata = errorData.cdnur;

                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {
                                            if (secData.dt[i].ref_key) {
                                                var old_ntnum = secData.dt[i].ref_key
                                                delete secData.dt[i].ref_key;
                                            }

                                            if (old_ntnum)
                                                keyObj.nt_num = old_ntnum;

                                            responseinvce.push(keyObj);

                                            var arrayFound = tbldata.myFind({
                                                'nt_num': responseinvce[0].nt_num
                                            });

                                            if (arrayFound.length != 0) {
                                                var index = tbldata.indexOf(arrayFound[0]);
                                                tbldata.splice(index, 1);
                                                tbldata.splice(index, 0, secData.dt[i])
                                                jsonObj.push(secData.cd + ":" + secData.dt[i].nt_num);
                                            }
                                        }

                                        break;
                                    case "cdnura":
                                        tbldata = errorData.cdnura;


                                        var responseinvce = [];
                                        var keyObj = {};

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (secData.dt[i].ref_key) {
                                                var refKey = secData.dt[i].ref_key,
                                                    refKeyParts = refKey.split('_'),
                                                    old_ontnum = refKeyParts[0],
                                                    old_ntnum = refKeyParts[1];

                                                delete secData.dt[i].ref_key;
                                            }
                                            if (old_ontnum && old_ntnum) {
                                                keyObj.nt_num = old_ntnum;
                                                keyObj.ont_num = old_ontnum;
                                            }



                                            responseinvce.push(keyObj);

                                            var arrayFound = tbldata.myFind({
                                                'ont_num': responseinvce[0].ont_num,
                                                'nt_num': responseinvce[0].nt_num
                                            });

                                            if (arrayFound.length != 0) {
                                                var index = tbldata.indexOf(arrayFound[0]);
                                                tbldata.splice(index, 1);
                                                tbldata.splice(index, 0, secData.dt[i])
                                                jsonObj.push(secData.cd + ":" + secData.dt[i].nt_num);
                                            }
                                        }

                                        break;

                                    case "exp":

                                        tbldata = errorData.exp;

                                        for (var i = 0; i < secData.dt.length; i++) {


                                            if (secData.dt[i].inv[0].ref_key) {
                                                var refKey = secData.dt[i].inv[0].ref_key,
                                                    refKeyParts = refKey.split('_'),
                                                    old_expType = refKeyParts[0],
                                                    old_inum = refKeyParts[1];
                                                delete secData.dt[i].inv[0].ref_key;
                                            }
                                            if (old_expType && old_inum) {
                                                keyObj.old_expType = old_expType;
                                                keyObj.old_inum = old_inum;
                                            }

                                            responseinvce.push(keyObj);

                                            var arrayFound = tbldata.myFind({
                                                'exp_typ': responseinvce[0].old_expType
                                            });



                                            if (arrayFound.length) {
                                                for (var j = 0; j < arrayFound.length; j++) {

                                                    var subarray = {};
                                                    subarray = arrayFound[j].inv;

                                                    var subArrayFound = subarray.myFind({
                                                        'inum': responseinvce[0].old_inum
                                                    });

                                                    if (subArrayFound.length == 1) {
                                                        tbldata.splice(j, 1);
                                                        tbldata.splice(j, 0, secData.dt[i]);
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    case "expa":

                                        tbldata = errorData.expa;


                                        for (var i = 0; i < secData.dt.length; i++) {


                                            if (secData.dt[i].inv[0].ref_key) {
                                                var refKey = secData.dt[i].inv[0].ref_key,
                                                    refKeyParts = refKey.split('_'),
                                                    old_expType = refKeyParts[0],
                                                    old_oinum = refKeyParts[1],
                                                    old_inum = refKeyParts[2];
                                                delete secData.dt[i].inv[0].ref_key;
                                            }
                                            if (old_expType && old_inum && old_oinum) {
                                                keyObj.old_expType = old_expType;
                                                keyObj.old_inum = old_inum;
                                                keyObj.old_oinum = old_oinum;

                                            }

                                            responseinvce.push(keyObj);

                                            var arrayFound = tbldata.myFind({
                                                'exp_typ': responseinvce[0].old_expType
                                            });



                                            if (arrayFound.length) {
                                                for (var j = 0; j < arrayFound.length; j++) {

                                                    var subarray = {};
                                                    subarray = arrayFound[j].inv;

                                                    var subArrayFound = subarray.myFind({
                                                        'inum': responseinvce[0].old_inum,
                                                        'oinum': responseinvce[0].old_oinum

                                                    });

                                                    if (subArrayFound.length == 1) {
                                                        tbldata.splice(j, 1);
                                                        tbldata.splice(j, 0, secData.dt[i]);
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].inv[0].inum);
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    case "at":
                                    case "atadj":
                                        if (secData.cd == 'at')
                                            tbldata = errorData.at;
                                        else
                                            tbldata = errorData.txpd;

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (secData.dt[i].ref_key) {
                                                var refKey = secData.dt[i].ref_key,
                                                    refKeyParts = refKey.split('_'),
                                                    oldPos = refKeyParts[0],
                                                    old_diffprcnt = refKeyParts[1];
                                                delete secData.dt[i].ref_key;
                                            }
                                            for (var j = 0; j < tbldata.length; j++) {
                                                if (!tbldata[j].diff_percent) {
                                                    tbldata[j].diff_percent = "";
                                                }

                                                if (tbldata[j].pos === oldPos) {
                                                    if (tbldata[j].diff_percent === old_diffprcnt) {
                                                        tbldata.splice(j, 1);
                                                        tbldata.splice(j, 0, secData.dt[i]);
                                                        jsonObj.push(secData.cd + ":" + secData.dt[i].pos);
                                                    }
                                                }
                                            }

                                        }
                                        break;
                                    case "ata":
                                    case "atadja":
                                        if (secData.cd == 'ata')
                                            tbldata = errorData.ata;
                                        else
                                            tbldata = errorData.txpda;

                                        for (var i = 0; i < secData.dt.length; i++) {

                                            if (secData.dt[i].ref_key) {
                                                var refKey = secData.dt[i].ref_key,
                                                    refKeyParts = refKey.split('_'),
                                                    oldPos = refKeyParts[0],
                                                    oldOmon = refKeyParts[1],
                                                    old_diffprcnt = refKeyParts[2];
                                                delete secData.dt[i].ref_key;
                                            }
                                            for (var j = 0; j < tbldata.length; j++) {
                                                if (!tbldata[j].diff_percent) {
                                                    tbldata[j].diff_percent = "";
                                                }

                                                if (tbldata[j].pos === oldPos) {
                                                    if (tbldata[j].omon === oldOmon) {
                                                        if (tbldata[j].diff_percent === old_diffprcnt) {
                                                            tbldata.splice(j, 1);
                                                            tbldata.splice(j, 0, secData.dt[i]);
                                                            jsonObj.push(secData.cd + ":" + secData.dt[i].pos + "_" + secData.dt[i].omon);
                                                        }
                                                    }
                                                }

                                            }
                                        }

                                        break;
                                    case "hsn":
                                        if (errorData.hsn) {
                                            tbldata = errorData.hsn[0];
                                        }

                                        if (errorData.hsnsum) {
                                            tbldata = errorData.hsnsum[0];
                                        }


                                        for (var i = 0; i < secData.dt.length; i++) {

                                            var arrayFound = tbldata.data.myFind({
                                                'num': secData.dt[i].num
                                            });
                                            if (arrayFound.length == 1) //no other case is possible.because update will be called for existing num only.So array found will always have a value of 1.
                                            {

                                                var index = tbldata.data.indexOf(arrayFound[0]);
                                                tbldata.data.splice(index, 1);
                                                tbldata.data.splice(index, 0, secData.dt[i]);

                                            }
                                        }
                                        break;

                                    case "nil":

                                        tbldata = errorData.nil;

                                        tbldata.inv = []; // empty the array to update
                                        for (var p = 0; p < secData.dt.length; p++) {
                                            tbldata.inv.push(secData.dt[p]);
                                        }

                                        break;

                                    default:
                                        logger.log("info", "Section not present");
                                }
                            }
                        }

                        var cache = [];
                        var configJSON = JSON.stringify(gstfile, function (key, value) {
                            if (typeof value === 'object' && value !== null) {
                                if (cache.indexOf(value) !== -1) {
                                    // Circular reference found, discard key
                                    return;
                                }
                                // Store value in our collection
                                cache.push(value);
                            }
                            return value;
                        });
                        cache = null;



                        fs.writeFileSync(filename, configJSON); // write into file after pushing data into it.
                        if (jsonObj.length == 0) {
                            logger.log("info", "No duplicate invoice found and data added successfully::%s", jsonObj);

                            if (isSameGSTIN == gstin) {
                                var responsegstin = [];
                                var gstinKey = {};
                                gstinKey.gstin = gstin;
                                responsegstin.push(gstinKey);
                                callback(err, responsegstin);
                            } else {
                                callback(null, "Success! Returns details added.");
                            }
                        } else {
                            logger.log("info", "duplicate invoice found and non duplicated rows added successfully");
                            callback(err, jsonObj);
                        }
                    }
                })



            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                errorObject = {
                    statusCd: err,
                    errorCd: err,
                };
                logger.log("error", "Error While adding the invoices :: %s", errorObject);
                response.error(errorObject, res);
            } else {
                logger.log("info", "Return Details Added Successfully :: %s", result);
                response.success(result, res)
            }

        })

    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while adding the invoices:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};


var updateData = function (req, res) {
    logger.log("info", "Entering Offline File:: updateaccepteddata ");
    var errorObject = null;
    try {
        var gstin = req.body.gstin;
        var form = req.body.form;
        var fy = req.body.fy;
        var month = req.body.month;
        var tblcd = req.body.tbl_cd;
        var tbl_data = req.body.tbl_data;
        var dir;
        logger.log("info", "Entering Offline File:: updatetbldata with tbl_data :: %s", tbl_data);
        logger.log("info", "Entering Offline File:: updatetbldata with tblcd :: %s", tblcd);
        //var invdltArray = req.body.invdltArray; // this will contain an array of objects.Each object will consist of ctin and respective invoice no. to update
        var type = req.body.type;
        var actionType = req.body.actionType;
        var filename;
        if (req.body.returnFileName)
            filename = __dirname + '/../public/' + req.body.returnFileName;
        else {
            dir = uploadedFiledir + gstin + "_" + form + "_" + fy + "_" + month;
            filename = dir + "/" + gstin + '_' + form + '_' + fy + '_' + month + '.json';
        }
        async.waterfall([
            function (callback) {
                fs.readFile(filename, 'utf8', function (err, data) {
                    if (err) {

                        logger.log("error", "error while reading the file :: %s ", err.message);
                        callback(null, tbl_data)
                    } else {
                        var gstfile = JSON.parse(data);
                        var tbldata;
                        if (typeof gstfile.backups === 'undefined') {
                            gstfile.backups = {
                                b2b: {},
                                cdnr: {}
                            };
                        }
                        var backups = gstfile.backups;
                        switch (tblcd) {
                            case "b2b":
                            case "b2ba":
                                for (var i = 0; i < tbl_data.length; i++) {
                                    for (var k = 0; k < gstfile[tblcd].length; k++) {
                                        if (gstfile[tblcd][k].ctin == tbl_data[i].ctin)
                                            for (var j = 0; j < gstfile[tblcd][k].inv.length; j++) {
                                                if (gstfile[tblcd][k].inv[j].inum == tbl_data[i].inum) {
                                                    gstfile[tblcd][k].inv[j].flag = actionType;
                                                    gstfile[tblcd][k].inv[j].updby = 'S';
                                                }
                                            }
                                    }
                                }
                                callback(null, gstfile)
                                break;
                            case "cdn":
                            case "cdnr":
                                for (var i = 0; i < tbl_data.length; i++) {
                                    for (var j = 0; j < gstfile[tblcd].length; j++) {
                                        if (gstfile[tblcd][j].ctin == tbl_data[i].ctin) {
                                            for (var k = 0; k < gstfile[tblcd][j].nt.length; k++)
                                                if (gstfile[tblcd][j].nt[k].inum == tbl_data[i].inum) {
                                                    gstfile[tblcd][j].nt[k].flag = actionType;
                                                    gstfile[tblcd][j].nt[k].updby = 'S';
                                                }
                                        }

                                    }
                                }
                                callback(null, gstfile)
                                break;

                            default:
                                logger.log("error", "This functionality is only for b2b and cdnr section and getting ::%s", tblcd);
                        }
                    }

                })
            },
            function (gstfile, callback) {
                if (type == "Upload") {
                    fs.writeFileSync(filename, JSON.stringify(gstfile));

                    callback(null, "Document updated successfully")
                } else {
                    fs.writeFileSync(filename, JSON.stringify(gstfile));

                    callback(null, "Document updated successfully")

                }


            }
        ], function (err, result) {
            logger.log("info", "entered in async.waterfall function")
            if (err) {
                logger.log("error", "err :: %s", err);
                if (err == "200OK") {
                    logger.log("error", "User cannot modify the rejected invoices :: %s", err);
                    response.success("You cannot modify the invoice if you are rejecting the invoice", res)
                } else {
                    errorObject = {
                        statusCd: 400,
                        errorCd: 400,
                    };
                    logger.log("error", "Error While updating the documents :: %s", errorObject);
                    console.log(err)
                    response.error(errorObject, res);
                }

            } else {
                logger.log("info", "Document updated successfully:: %s", result);
                response.success(result, res)
            }

        })
    } catch (err) {
        errorObject = {
            statusCd: errorConstant.STATUS_500,
            errorCd: errorConstant.STATUS_500,
        };
        logger.log("error", "Unexpected error while updating the data:: %s", err.message);
        response.error(errorObject, res);
    } finally {
        errorObject = null;
    }

};

//If the first row in the excel doesn't carry CFS flag but the 2nd one does,
//then CFS flag doesn't get populated.
//To resolve this issue, find a row for the same ctin which has CFS flag
//and swap both.
//If no match is found, return as it is.
//Subrat

function findAndSwapCFSInv(secData, currIndex) {
    var secName = secData.cd;
    if (secName == 'b2b' || secName == 'cdnr') {
        var currCtin = secData.dt[currIndex].ctin;
        for (var i = currIndex + 1; i < secData.dt.length; i++) {
            if (secData.dt[i].ctin == currCtin && secData.dt[i].hasOwnProperty('cfs')) {
                var tempObj = secData.dt[currIndex];
                secData.dt[currIndex] = secData.dt[i];
                secData.dt[i] = tempObj;
                return;
            }
        }
    }

}

//Loads HSN codes
function loadHSNData(req, res, err) {
    var searchtext = req.params['searchText'];
    logger.log("info", "in loadHSNData : searchText - " + searchtext);
    try {
        var fileData = fs.readFileSync(__dirname + '/../public/data/HSN.json', "utf8");
        fileData = JSON.parse(fileData);
        var result = { data: [] };
        if (searchtext != null) {
            fileData.data.forEach((obj, index) => {
                // var indexOfN = obj.c.indexOf(searchtext)
                var pattern = new RegExp("^\\d{2,8}$");
                var indexOfN = -1;
                var indexOfC = -1;
                if(pattern.test(searchtext)){
                    indexOfN = obj.c.substring(0,searchtext.length) == searchtext ? 0 : -1;
                }
                else{
                    indexOfC = obj.n.toLowerCase().indexOf(searchtext.toLowerCase());
                }
    
                if (indexOfN >= 0) {
                    obj["i"] = indexOfN;
                    result.data.push(obj);
                }
                else if (indexOfC >= 0) {
                    obj["i"] = indexOfC;
                    result.data.push(obj);
                }
            });
            result.data = sortJSON(result.data, "c");
            result.data = sortJSON(result.data, "i");
            result.data.forEach((obj, index) => {
                delete result.data[index]["i"];
            });
        }
        res.send(result);
    }
    catch (err) {
        logger.log("error", "NO JSON FILE EXISTS FOR SELECTION");
        res.status(404).end();
    }
}

function hsnDescForOfflineTool(req, res, err) {
    var searchtext = req.params['searchText'];
    logger.log("info", "in loadHSNData : searchText - " + searchtext);
    try {
        var fileData = fs.readFileSync(__dirname + '/../public/data/HSN.json', "utf8");
        fileData = JSON.parse(fileData);
        if (searchtext != null) {
            var result = { data: [] };
            var searchList;
            searchList = fileData.data.filter(obj => obj.c == searchtext);
            result.data = searchList[0].n;
            res.send(result);
        }
        else {
            res.send(fileData);
        }
    }
    catch (err) {
        logger.log("error", "NO JSON FILE EXISTS FOR SELECTION");
        res.status(404).end();
    }
}

function isCurrentPeriodBeforeAATOCheck(start_period, current_period) {
    var pattern = /((0[1-9])|10|11|12)([2][0-9][0-9][0-9])/;
    if (start_period == undefined || current_period == undefined) {
        return false;
    }
    if (!pattern.test(current_period) || !pattern.test(start_period)) {
        return false;
    }
    var start_period_month = parseInt(start_period.slice(0, 2));
    var start_period_year = parseInt(start_period.slice(2, 6));
    var current_period_month = parseInt(current_period.slice(0, 2));
    var current_period_year = parseInt(current_period.slice(2, 6));
    if (current_period_year > start_period_year) {
        return false;
    } else if (current_period_year < start_period_year) {
        return true;
    } else {
        return current_period_month < start_period_month;
    }
}

function sortJSON(arr, key) {
    return (arr.sort(function (a, b) {
        var x = parseInt(a[key]);
        var y = parseInt(b[key]);
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    }))
}

module.exports = {
    addtbldata: addtbldata,
    generateFile: generateFile,
    fetchMeta: fetchMeta,
    itemExists: itemExists,
    deleteallinvoices: deleteallinvoices,
    deleteMltplInv: deleteMltplInv,
    upload: upload,
    listJsonData: listJsonData,
    unzip: unzip,
    unzipError: unzipError,
    updatetbldata: updatetbldata,
    updateData: updateData,
    addmltpldata: addmltpldata,
    addmltplerrdata: addmltplerrdata,
    generateZip: generateZip,
    updateaccepteddata: updateaccepteddata,
    updateerrdata: updateerrdata,
    generateErrorFile: generateErrorFile,
    unzipFile: unzipFile,
    importFile: importFile,
    setDeleteFlag: setDeleteFlag,
    setFlagAll: setFlagAll,
    deleteErrData: deleteErrData,
    updateImport: updateImport,
    clearSectionData: clearSectionData,
    loadHSNData: loadHSNData,
    hsnDescForOfflineTool: hsnDescForOfflineTool,
    saveMstrforprod: saveMstrforprod,
    getMasterData: getMasterData
}