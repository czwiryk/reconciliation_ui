declare interface GapiClientRequestParams {
  path: string;
  params: Object;
}

declare interface GapiClientRequest {
  execute(callBack:(Object)=>void):void;
}

declare interface GapiClient {
  setApiKey(key:string);
  request(p:GapiClientRequestParams):GapiClientRequest;
  load(api:string, version:string, onSetup:()=>void);
}

declare module gapi {
  export var client : GapiClient;
    //export request();
    //declare request(p:GapiClientRequest):GapiClientQuery;

  export var auth : {
    getToken():string;
    authorize(params:Object, handler:(Object)=>any);
  };
}
