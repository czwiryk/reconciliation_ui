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

function getCandidates(entity, callback) {
    var query = {}
    var headers = entity["/rec_ui/headers"];
    for (var i = 0; i < headers.length; i++) {
        var prop = headers[i];
        var value = entity[prop];
        
        function constructQueryPart(value) {
            if (value.id != undefined && value.id != "" && value.id != "None")
                return {"id":value.id, "name":value["/type/object/name"]}
            return value["/type/object/name"] || value;
        }
        if (value != undefined && value != null && value != "" && prop != "id") {
            if(query[prop] == undefined)
                query[prop] = [];
            query[prop] = query[prop].concat($.map($.makeArray(value), constructQueryPart));
        }
    }
    function handler(results) {
        entity.reconResults = results; 
        callback(entity);
    }
    $.getJSON(reconciliation_url + "query?jsonp=?", {q:JSON.stringify(query), limit:4}, handler);
}

function autoReconcileResults(entity) {
    automaticQueue.shift();
    // no results, set to None:
    if(entity.reconResults.length == 0) {
        entity["id"] = "None";
        console.warn("No results:");
        console.warn(entity);
        addColumnRecCases(entity);
    }        
    // match found:
    else if(entity.reconResults[0]["match"] == true) {
        entity["id"] = entity.reconResults[0]["id"];
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
    var val = getFirstValue(manualQueue);
    if(val != undefined) {
        $.historyLoad(val["/rec_ui/id"])
        renderReconChoices(getSecondValue(manualQueue)); //render-ahead the next one
    }
    else{
        $(".manualQueueEmpty").show();
        $(".manualReconciliation").hide();
        $(".manualReconChoices:visible").remove();
    }
}

function displayReconChoices(entityID) {
    var entity = entities[entityID];
    if (entity === undefined) return;
    $(".manualQueueEmpty").hide();
    $(".manualReconciliation").show();
    //remove rather than hide to prevent memory leaks
    $(".manualReconChoices:visible").remove();
    
    if (! $("#manualReconcile" + entityID)[0])
        renderReconChoices(entity);
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
        currentRecord.append(node("div",displayValue(entity[headers[i]])));
    }
    
    var tableHeader = $(".reconciliationCandidates table thead", template);
    var columnHeaders = ["","Image","Names","Types"].concat(mqlProps).concat(["Score"]);
    for (var i = 0; i < columnHeaders.length; i++)
        tableHeader.append(node("th",columnHeaders[i]));
    
    var tableBody = $(".reconciliationCandidates table tbody", template);
    for (var i = 0; i < entity.reconResults.length; i++)
        tableBody.append(renderCandidate(entity.reconResults[i], mqlProps));

    $('.reconciliationCandidates table tbody tr:odd', template).addClass('odd');
    $('.reconciliationCandidates table tbody tr:even', template).addClass('even');
    $(".find_topic", template)
        .freebaseSuggest()
        .bind("fb-select", function(e, data) { 
          handleReconChoice(entity["/rec_ui/id"], data.id);
        });
    $(".manualSelection", template).click(function(val) {handleReconChoice(entity, this.name)});
    template.insertAfter("#manualReconcileTemplate")

    fetchMqlProps(entity);
}

function renderCandidate(result, mqlProps) {
    var url = freebase_url + "/view/" + result['id'];
    var tableRow = node("tr", {"class":idToClass(result["id"])});
    
    var button = node("button", "Select", 
       {"class":'manualSelection', 
        "name":result.id})
    tableRow.append(node("td",button));
    
    node("td",
         node("img",{src:freebase_url + "/api/trans/image_thumb/"+result['id']+"?maxwidth=100&maxheight=100"})
    ).appendTo(tableRow);
    
    var names = node("td").appendTo(tableRow);
    for(var j = 0; j < result["name"].length; j++) {
        names.append(node("a",result["name"][j], {target:"_blank", href:url})).append(node("br"));
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
    for (var i = 0; i < entity.reconResults.length; i++) {
        var result = entity.reconResults[i];
        var query = {"id":result["id"],
                     "/type/reflect/any_master" : [
                       {
                         "link|=" : mqlProps,
                         "link" : null,
                         "id" : null,
                         "name" : null,
                         "optional" : true
                       }
                     ],
                     "/type/reflect/any_value" : [
                       {
                         "link|=" : mqlProps,
                         "link" : null,
                         "value" : null,
                         "optional" : true
                       }
                     ],
                     "/type/reflect/any_reverse" : [
                        {
                          "link" : {"master_property":{"reverse_property|=":mqlProps,
                                    "reverse_property":null}},
                          "id" : null,
                          "name" : null,
                          "optional" : true
                        }
                      ],
                    };
        var envelope = {query:query};
        function handler(results) {
            fillInMQLProps(entity, results);
        }
        $.getJSON(freebase_url + "/api/service/mqlread?callback=?&", {query:JSON.stringify(envelope)}, handler);
    }
}

function fillInMQLProps(entity, mqlResult) {
    var context = $("#manualReconcile" + entity["/rec_ui/id"]);
    if (mqlResult["code"] != "/api/status/ok" || mqlResult["result"] == null) {
        //don't show annoying loading symbols indefinitely if there's an error
        $(".replaceme",context).empty();
        console.error(mqlResult);
        return;
    }

    var result = mqlResult.result;
    var entity = $("tr." + idToClass(result.id),context);
    $(".replaceme", entity).empty();
    
    var props = result["/type/reflect/any_master"].concat(
                result["/type/reflect/any_value"]).concat(
                result["/type/reflect/any_reverse"]);
    for (var i = 0; i < props.length; i++) {
        var prop = props[i];
        var link = prop.link;
        if (link.master_property != undefined)
            link = link.master_property.reverse_property;
        var cell = $("td." + idToClass(link), entity);
        if (prop.value != undefined)
            cell.html(cell.html() + prop.value + " <br/>");
        else
            cell.html(cell.html() + freebaseLink(prop.id, prop.name) + "<br/>")
    }
}

function handleReconChoice(entity,freebaseId) {
    delete manualQueue[entity["/rec_ui/id"]];
    if (freebaseId != undefined)
        entity.id = freebaseId;
    addColumnRecCases(entity);
    updateUnreconciledCount();
    manualReconcile();
}
