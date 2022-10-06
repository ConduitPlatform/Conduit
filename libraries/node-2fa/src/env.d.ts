declare module 'thirty-two' {
  const _default: {
    encode: (plain: string | Buffer) => Buffer;
    decode: (encoded: string | Buffer) => Buffer;
  };

  export = _default;
}
