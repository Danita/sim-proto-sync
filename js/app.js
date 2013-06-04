/**
 * 
 * Prueba de concepto sincronización mobile-viajeros
 * 25/01/2013
 * Daniela
 * 
 */

/**
 * Modelito de items a sincronizar
 * 
 */
function ItemsModel()
{
	var self = this;
			
	this.aItems = [ 
		{id: 10, name:"fotografía"}, 
		{id: 22, name:"pintura"},
		{id: 74, name:"karate"},
		{id: 42, name:"tomar mate"},
		{id: 36, name:"futbol"},
		{id: 98, name:"viajar"},
		{id: 2, name:"comida"},
		{id: 17, name:"ciclismo"},
		{id: 64, name:"programación"},
		{id: 87, name:"star trek"},
		{id: 29, name:"juegos"},
		{id: 90, name:"manejar"},
		{id: 88, name:"cantar"},
		{id: 34, name:"conocer lugares"},
		{id: 4, name:"natación"},
		{id: 55, name:"diseño"},
		{id: 6, name:"jardinería"},
		{id: 81, name:"enseñar"},
		{id: 77, name:"star wars"},
		{id: 1, name:"javascript"}
	];
	
	this.findBy = function(field, value)
	{
		var ret;
		$.each( this.aItems, function(k, obj) { 
			if (obj[field] == value) { 
				ret = obj;
			}
		});
		return ret;
	}

	this.create = function( obj )
	{
		var objPreexistente = self.findBy('name', obj.name);
		if ( objPreexistente ) {
			return objPreexistente; // create es idempotente.
		} else {		
			obj.id = 100 + Math.floor(Math.random() * 500);
			this.aItems.push(obj);
			return obj;
		}
	}

	this.getRandomExcluding = function(aExclude)
	{
		var aItemsRestantes = [];
		if (aExclude && aExclude.length) {
			$.each( this.aItems, function(k, obj) {				
				if ( !self.isObjectInArray(obj, aExclude) ) {
					aItemsRestantes.push(obj);
				}
			});
		} else {
			aItemsRestantes = this.aItems;
		}
		
		var cant = aItemsRestantes.length
		var rand = Math.floor( Math.random() * cant );
		return aItemsRestantes[rand];
	}
	
	this.isObjectInArray = function(needle, haystack )
	{
		var ret = false;
		$.each( haystack, function(k, obj) {
			if ( JSON.stringify(needle) == JSON.stringify(obj) ) {
				ret = true;
			}		
		});
		return ret;
	}
	
}

/**
 * Simulación viajeros
 * 
 */
function BackendViajeros( ItemDB )
{
	var self = this;
	
	this.db = [];
	this.clock = 0;
	this.$container = $("#viajeros");
	this.$btnAdd = $('.js-add', this.$container);
	this.$fldName = $('.js-add-name', this.$container);
	this.$clock = $('.js-clock', this.$container);
	this.$itemContainer = $('.js-items', this.$container);
	
	this.init = function()
	{
		// Agregar item
		this.$btnAdd.bind('click', function(e) {
			e.preventDefault();
			var newItem = ItemDB.getRandomExcluding(self.db);
			
			self.clock ++;	
			
			self.addItem( newItem );
			self.updateView();
		});
		
		// Borrar item		
		this.$container.on('click', '.js-delete', function(e) {
			e.preventDefault();
			var order = $(this).data('order');
			
			self.clock ++;			
			
			self.deleteItemByOrder(order);
			self.updateView();
		});
	}
	
	this.sync = function( data )
	{
		console.info("Viajeros recibe", data);
		
		var aReceivedItems = data.db;
		var receivedClock = data.clock;
		
		
		/*
		 * Reglas sync viajeros.
		 * 
		 * Si el id en mensaje no existe y en viajeros existe, se borra en viajeros
		 * Si el id en mensaje no existe y en viajeros existe, pero hora mensaje menor a hora viajeros, se ignora en viajeros
		 * Si el id en mensaje existe y en viajeros no existe, se agrega en viajeros
		 * Si el id en mensaje existe y en viajeros no existe, pero hora mensaje menor hora viajeros, se ignora en viajeros.
		 * Si se envia elemento sin id, se agrega en viajeros.
		 */
		
		console.log('Clock Viajeros es: '+ self.clock);
		
		var hadChanges = false;
		var ret;
		
		$.each( aReceivedItems, function(k, obj) {
			
			// Si se recibe elemento sin id, se agrega en viajeros.
			if ( !obj.id ) {
				console.log('Objeto recibido sin id: ', obj, ' se agrega en viajeros');
				var newItem = ItemDB.create( obj );
				self.addItem( newItem );
				aReceivedItems[k].id = newItem.id; // ASIGNAR EL ID AHORA porque sino luego falla la comprobación de existencia en viajeros.
				hadChanges = true;
				
			// Si el id en mensaje existe y en viajeros no existe, se agrega en viajeros 
			} else if ( !self.isObjectInArray( obj, self.db ) && receivedClock >= self.clock ) {
				
				console.log('Objeto recibido con id pero que en viajeros no existe: ', obj, ' se agrega en viajeros');
				self.addItem( obj );			
				hadChanges = true;
				
			} 			
			
		});
				
		$.each( self.db, function(k, obj) {
			
			// Si el id existe en viajeros y no en el mensaje, se borra en viajeros 
			if ( !self.isObjectInArray( obj, aReceivedItems ) &&  receivedClock >= self.clock ) {
				
				console.log('Objeto que existe en viajeros pero en el mensaje falta: ', obj, ' se borra de viajeros');
				self.deleteItem(obj);
				hadChanges = true;
				
			}
			
		});
		
		if ( hadChanges ) {
			self.clock++;			
		}
		
		ret = {
			clock : self.clock,
			db : self.db.slice(0) // clon de nuestra db
		}
		
		self.updateView();
		
		return ret;
		
	}
	
	this.addItem = function( item )
	{
		if (!self.isObjectInArray(item, self.db)) { // idempotente
			self.db.push( item );
		}
	} 
	
	this.deleteItemByOrder = function( order )
	{
		self.db.splice(order, 1);
	}
	
	this.deleteItem = function( item )
	{
		console.log('delete', item);
		var newDb = [];
		$.each( self.db, function(k, obj) {
			if ( obj.id !== item.id ) {
				newDb.push(obj);
			}
		});
		self.db = newDb.slice(0);
	}
	
	this.isObjectInArray = function(needle, haystack )
	{
		var ret = false;
		$.each( haystack, function(k, obj) {
			if ( JSON.stringify(needle) == JSON.stringify(obj) ) {
				ret = true;
			}		
		});
		return ret;
	}
	
	this.updateView = function() 
	{
		self.$itemContainer.empty();
		$.each( self.db, function(k, obj) {
			var itemHTML = '<li>'
			+ obj.id + ': ' + obj.name +
			'<i class="js-delete icon-trash" data-order="' + k + '"></i></li>';
			self.$itemContainer.append(itemHTML);
		});
		
		if (self.clock) {
			self.$clock.text(self.clock);
		}
		
	}
	
}

/**
 * Simulación app mobile
 * 
 */
function MobileApp(id, SyncTarget)
{
	var self = this;
	
	this.id = id;
	this.db = [];
	this.clock = 0;
	
	this.$container = $("#" + this.id);
	this.$btnAdd = $('.js-add', this.$container);
	this.$fldName = $('.js-add-name', this.$container);
	this.$btnSync = $('.js-sync', this.$container);
	this.$clock = $('.js-clock', this.$container);
	this.$itemContainer = $('.js-items', this.$container);
		
	this.init = function()
	{
		// Agregar item
		this.$btnAdd.bind('click', function(e) {
			e.preventDefault();
			var newItem = {
				id : null,
				name : self.$fldName.val()
			}			
			
			self.addItem(newItem);
			self.$fldName.val('');
			self.updateView();
		});
		
		// Borrar item		
		this.$container.on('click', '.js-delete', function(e) {
			e.preventDefault();
			var order = $(this).data('order');
		
			self.deleteItemByOrder(order);
			self.updateView();
		});
		
		// Sincronizar
		this.$btnSync.bind('click', function(e) {
			e.preventDefault();			
			self.sync();
		});
		
	}
	
	this.sync = function()
	{
		
		var response = SyncTarget.sync( 
			{ 
				clock : self.clock,
				db : self.db
			}
		);
			
		console.warn("App " + self.id + " recibe:", response);
		
		/**
		 * Reglas aplicación mobile.
		 * 
		 * Si se reciben datos, reemplazar
		 * Si se recibe null, ignorar
		 */
		
		self.clock = response.clock;
		
		if ( response.db ) {
			
			// Pisar nuestra db.
			self.db = response.db
		}
		
		self.updateView();
	}
	
	this.addItem = function(item)
	{
		self.db.push(item);
	}
	
	this.deleteItemByOrder = function(order)
	{
		self.db.splice(order, 1);
	}
	
	this.updateView = function() 
	{
		self.$itemContainer.empty();
		$.each( self.db, function(k, obj) {
			var itemHTML = '<li>'
			+ obj.id + ': ' + obj.name +
			'<i class="js-delete icon-trash" data-order="' + k + '"></i></li>';
			self.$itemContainer.append(itemHTML);
		});
		
		if (self.clock) {
			self.$clock.text(self.clock);
		}
		
	}
	
}


var ItemDB = new ItemsModel();
var Viajeros = new BackendViajeros(ItemDB);
var App1 = new MobileApp('app1', Viajeros);
var App2 = new MobileApp('app2', Viajeros);
var App3 = new MobileApp('app3', Viajeros);

Viajeros.init();
App1.init();
App2.init();
App3.init();