/** @constructor */
function InternalReconciler() {
    /** @type !Object.<!string,!Object.<!string,!RecGroup>> */
    this.byType = {};
}

/** @param {!tEntity} entity */
InternalReconciler.prototype.register = function(entity) {
    var recGroup = this.getRecGroup(entity);
    if (recGroup === undefined)
        return;
    recGroup.register(entity);
}

/** @param {!tEntity} entity
  * @param {!boolean} shouldMerge*/
InternalReconciler.prototype.setMerged = function(entity, shouldMerge) {
    this.getRecGroup(entity).shouldMerge = shouldMerge;
}

/** @param {!tEntity} entity 
  * @return {(!RecGroup|undefined)}
  */
InternalReconciler.prototype.getRecGroup = function(entity) {
    var type = entity.get("/type/object/type")[0];
    var name = entity.get("/type/object/name")[0];
    if (Arr.any([type, name], isUndefined))
        return undefined;
    return this._getRecGroup(type, name);
}

/** @param {!string} type
  * @param {!string} name
  * @return {!RecGroup}
  */
InternalReconciler.prototype._getRecGroup = function(type, name) {
    if (!(type in this.byType))
        this.byType[type] = {};
    var byName = this.byType[type];
    if (!(name in byName))
        byName[name] = new RecGroup(type, name);
    return byName[name];
}

RecGroup.groups = [];
RecGroup.id_counter = 0;
/** @constructor */
function RecGroup(type, name) {
    this.type = type; this.name = name;
    /** @type !Array.<!tEntity> */
    this.members = [];
    /** @type boolean */
    this.shouldMerge = false;
    this.internal_id = RecGroup.id_counter++;
    RecGroup.groups[this.internal_id] = this;
}

RecGroup.prototype.register = function(entity) {
    this.members.push(entity);
    if (entity['/type/object/type'][0] !== this.type)
        error("entity with type " + entity['/type/object/type'][0] + " registered to RecGroup of type " + this.type);
    if (entity['/type/object/name'][0] !== this.name)
        error("entity with name " + entity['/type/object/name'][0] + " registered to RecGroup of name " + this.name);
}

RecGroup.prototype.setID = function(id) {
    this.reconciledTo = id;
}

RecGroup.prototype.getID = function() {
    return this.reconciledTo;
}

RecGroup.prototype.getInternalID = function() {
    return this.internal_id;
}
