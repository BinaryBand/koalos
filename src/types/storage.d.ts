declare class Complex {
  public type: 'map' | 'big_map' | 'list' | 'option' | 'lambda' | 'operation';
  constructor(type: 'map' | 'big_map' | 'list' | 'option' | 'lambda' | 'operation');
}

declare class MichelsonMap extends Complex {
  constructor(key: string, valueType: Michelson);
}

declare class BigMap extends Complex {
  constructor(key: string, valueType: Michelson);
}

declare class List extends Complex {
  public valueType: Michelson;
  constructor(valueType: Michelson);
}

declare class Optional extends Complex {
  public argumentType: Michelson;
  constructor(argumentType: Michelson);
}

declare class Lambda extends Complex {
  constructor(parameter: Michelson, returnType: Michelson);
}
