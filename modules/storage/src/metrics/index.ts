import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  containers: {
    type: MetricType.Gauge,
    config: {
      name: 'containers_total',
      help: 'Tracks the total number of containers',
    },
  },
  folders: {
    type: MetricType.Gauge,
    config: {
      name: 'folders_total',
      help: 'Tracks the total number of folders',
    },
  },
  files: {
    type: MetricType.Gauge,
    config: {
      name: 'files_total',
      help: 'Tracks the total number of files',
    },
  },
  storageSize: {
    type: MetricType.Gauge,
    config: {
      name: 'storage_size_bytes_total',
      help: 'Tracks the cumulative size of all files in bytes',
    },
  },
};
