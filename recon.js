// ========================================================================
// Copyright (c) 2008-2009, Metaweb Technologies, Inc.
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
// 
// THIS SOFTWARE IS PROVIDED BY METAWEB TECHNOLOGIES AND CONTRIBUTORS
// ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL METAWEB
// TECHNOLOGIES OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
// OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
// DAMAGE.
// ========================================================================


/*
**  Automatic reconciliation
*/
var manualQueue = {};
var automaticQueue = [];

function beginAutoReconciliation() {
    $(".nowReconciling").show();
    $(".notReconciling").hide();
    $("#gettingInput").remove();
    autoReconcile();
}

function finishedAutoReconciling() {
    $(".nowReconciling").hide();
    $('.notReconciling').show();
}

function autoReconcile() {
    if (automaticQueue.length == 0) {
        finishedAutoReconciling();
        return;
    }
    updateUnreconciledCount();
    getCandidates(automaticQueue[0], autoReconcileResults);
}

function constructReconciliationQuery(entity) {
    function constructQueryPart(value) {
        if (value.id != undefined && value.id != "" && value.id != "None")
            return {"id":value.id, "name":value["/type/object/name"]}
        return value["/type/object/name"] || value;
    }

    var query = {}
    var headers = entity["/rec_ui/headers"];
    for (var i = 0; i < headers.length; i++) {
        var prop = headers[i];
        var parts = prop.split(":");
        $.each($.makeArray(getChainedProperty(entity,prop)),function(j, value) {
            var slot = query;
            if (value == undefined || value == "")
                return;
            if (parts.length === 1){
                slot[prop] = slot[prop] || [];
                slot[prop][j] = constructQueryPart(value);
                return;
            }
            
            slot[parts[0]]    = slot[parts[0]]    || [];
            slot[parts[0]][j] = slot[parts[0]][j] || {};
            slot = slot[parts[0]][j]
            $.each(parts.slice(1,parts.length-1), function(k,part) {
                slot[part] = slot[part] || {};
                slot = slot[part];
            });
            var lastPart = parts[parts.length-1];
            slot[lastPart] = constructQueryPart(value);
        })        
    }
    return query;
}

function getCandidates(entity, callback) {
    function handler(results) {
        entity.reconResults = results; 
        callback(entity);
    }
    var limit = 4;
    if (entity.reconResults)
        limit = entity.reconResults.length * 2;
    var query = constructReconciliationQuery(entity);
    $.getJSON(reconciliation_url + "query?jsonp=?", {q:JSON.stringify(query), limit:limit}, handler);
}

function autoReconcileResults(entity) {
    automaticQueue.shift();
    // no results, set to None:
    if(entity.reconResults.length == 0) {
        entity["id"] = "None";
        warn("No results:");
        warn(entity);
        addColumnRecCases(entity);
    }        
    // match found:
    else if(entity.reconResults[0]["match"] == true) {
        entity.id = entity.reconResults[0].id;
        canonicalizeFreebaseId(entity);
        entity["/rec_ui/freebase_name"] = entity.reconResults[0].name;
        addColumnRecCases(entity);
    }
    else {
        var wasEmpty = isObjectEmpty(manualQueue);
        manualQueue[entity["/rec_ui/id"]] = entity;
        if (wasEmpty)
            manualReconcile();
    }
    autoReconcile();
}

/*
** Manual Reconciliation
*/

function manualReconcile() {
    if ($(".manualReconChoices:visible").length === 0) {
        var val = getFirstValue(manualQueue);
        if(val != undefined) {
            $.historyLoad(val["/rec_ui/id"])
            renderReconChoices(getSecondValue(manualQueue)); //render-ahead the next one
        }
        else{
            $(".manualQueueEmpty").show();
            $(".manualReconciliation").hide();
        }
    }
}

function displayReconChoices(entityID) {
    var entity = entities[entityID];
    if (entity === undefined) return;
    $(".manualQueueEmpty").hide();
    $(".manualReconciliation").show();
    if (! $("#manualReconcile" + entityID)[0])
        renderReconChoices(entity);
    $(".manualReconChoices:visible").remove();
    $("#manualReconcile" + entityID).show();
}

function renderReconChoices(entity) {
    if (entity == undefined) return;
    var template = $("#manualReconcileTemplate").clone();
    template[0].id = "manualReconcile" + entity['/rec_ui/id'];
    var headers = entity["/rec_ui/headers"];
    var mqlProps = entity["/rec_ui/mql_props"];
    
    var currentRecord = $(".recordVals",template);
    for(var i = 0; i < headers.length; i++) {
        currentRecord.append(node("label", headers[i] + ":", {"for":idToClass(headers[i])}));
        currentRecord.append(node("div").append(displayValue(getChainedProperty(entity,headers[i]))));
    }
    
    var tableHeader = $(".reconciliationCandidates table thead", template).empty();
    var columnHeaders = ["","Image","Names","Types"].concat(mqlProps).concat(["Score"]);
    for (var i = 0; i < columnHeaders.length; i++)
        tableHeader.append(node("th",columnHeaders[i]));
    
    var tableBody = $(".reconciliationCandidates table tbody", template).empty();
    for (var i = 0; i < entity.reconResults.length; i++)
        tableBody.append(renderCandidate(entity.reconResults[i], mqlProps, entity));

    $('.reconciliationCandidates table tbody tr:odd', template).addClass('odd');
    $('.reconciliationCandidates table tbody tr:even', template).addClass('even');
    $(".find_topic", template)
        .freebaseSuggest()
        .bind("fb-select", function(e, data) { 
          entity['/rec_ui/freebase_name'] = $.makeArray(data.name);
          handleReconChoice(entity, data.id);
        });
    $(".otherSelection", template).click(function() {handleReconChoice(entity, this.name)});
    $(".moreButton",template).click(function() {
        $(".loadingMoreCandidates", template).show();
        getCandidates(entity, function() {
            $("#manualReconcile" + entity["/rec_ui/id"]).remove();
            displayReconChoices(entity["/rec_ui/id"]);
        })
    })
    template.insertAfter("#manualReconcileTemplate")

    fetchMqlProps(entity);
}

function renderCandidate(result, mqlProps, entity) {
    var url = freebase_url + "/view/" + result['id'];
    var tableRow = node("tr", {"class":idToClass(result["id"])});
    
    var button = node("button", "Select", 
       {"class":'manualSelection', 
        "name":result.id})
    tableRow.append(node("td",button));
    button.click(function(val) {entity['/rec_ui/freebase_name'] = result.name; handleReconChoice(entity, result.id)})
    
    node("td",
         node("img",{src:freebase_url + "/api/trans/image_thumb/"+result['id']+"?maxwidth=100&maxheight=100"})
    ).appendTo(tableRow);
    
    var names = node("td").appendTo(tableRow);
    for(var j = 0; j < result["name"].length; j++) {
        var name = node("a",result["name"][j], {target:"_blank", href:url});
        miniTopicFloater(name, result['id']);
        names.append(name).append(node("br"));
    }

    
    tableRow.append(node("td",result["type"].join("<br/>")));
    
    for(var j = 0; j < mqlProps.length; j++)
        tableRow.append(
            node("td", node("img",{src:"spinner.gif"}),
                 {"class":"replaceme "+idToClass(mqlProps[j])})
        );
    tableRow.append(node("td",result["score"]));
    return tableRow;
}

function fetchMqlProps(entity) {
    var mqlProps = entity["/rec_ui/mql_props"];
    if (mqlProps.length === 0) return;
    for (var i = 0; i < entity.reconResults.length; i++) {
        var result = entity.reconResults[i];
        var query = {"id":result["id"]};
        var simpleProps = $.grep(mqlProps, function(prop){return !prop.match(":")})
        for (var j = 0; j < simpleProps.length; j++) {
            if (isValueProperty(simpleProps[j]))
                query[simpleProps[j]] = [];
            else
                query[simpleProps[j]] = [{"name":null,"id":null,"optional":true}];
        }
        var envelope = {query:query};
        function handler(results) {
            fillInMQLProps(entity, results);
            //don't show annoying loading symbols indefinitely if there's an error
            $("#manualReconcile" + entity["/rec_ui/id"] + " .replaceme").empty();
        }
        $.getJSON(freebase_url + "/api/service/mqlread?callback=?&", {query:JSON.stringify(envelope)}, handler);
    }
}

function fillInMQLProps(entity, mqlResult) {
    var context = $("#manualReconcile" + entity["/rec_ui/id"]);
    if (!mqlResult || mqlResult["code"] != "/api/status/ok" || mqlResult["result"] == null) {
        error(mqlResult);
        return;
    }

    var result = mqlResult.result;
    var entity = $("tr." + idToClass(result.id),context);
    
    
    for (var i = 0; i < mqlProps.length; i++) {
        var cell = $("td." + idToClass(mqlProps[i]), entity).empty();
        cell.append(displayValue(getChainedProperty(result, mqlProps[i])));
        cell.removeClass("replaceme");
    }
}

function handleReconChoice(entity,freebaseId) {
    delete manualQueue[entity["/rec_ui/id"]];
    $("#manualReconcile" + entity['/rec_ui/id']).remove();
    if (freebaseId != undefined){
        entity.id = freebaseId;
        canonicalizeFreebaseId(entity);
    }
    addColumnRecCases(entity);
    updateUnreconciledCount();
    manualReconcile();
}


function canonicalizeFreebaseId(entity) {
    var envelope = {query:{"myId:id":entity.id, "id":null}}
    $.getJSON(freebase_url + "/api/service/mqlread?callback=?&", {query:JSON.stringify(envelope)}, function(results){
        if (results && results.result && results.result.id)
            entity.id = results.result.id
    });
}