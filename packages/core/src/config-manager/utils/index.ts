export const getAddressType = (address: string) => {
  const ipv4Regex = new RegExp(
    '^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
  );
  const ipv6Regex = new RegExp('^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$');
  if (ipv4Regex.test(address.split(':')[0])) {
    return 'ipv4';
  } else if (ipv6Regex.test(address)) {
    return 'ipv6';
  } else {
    return 'dns';
  }
};

export const formatAddress = (address: string, addressType: 'ipv4' | 'ipv6' | 'dns') => {
  if (addressType === 'dns') {
    return address;
  } else if (addressType === 'ipv4') {
    return `${address}`;
  } else {
    const [ipPart, port] = address.includes(']:') ? address.split(']:') : [address, ''];
    const ip = ipPart.replace(/^\[|\]$/g, '');
    return port ? `[${ip}]:${port}` : `${ip}`;
  }
};
