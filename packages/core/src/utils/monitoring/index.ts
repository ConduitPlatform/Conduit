// @ts-ignore
import appmetrics from 'appmetrics-dash';
import { isNil } from 'lodash';

export class MonitoringUtility {
  private static instance: MonitoringUtility;
  private enabled: boolean;

  private constructor() {
    this.enabled = false;
  }

  static getInstance() {
    if (isNil(MonitoringUtility.instance)) {
      MonitoringUtility.instance = new MonitoringUtility();
    }
    return MonitoringUtility.instance;
  }

  enableMetrics() {
    if (this.enabled) {
      return;
    }
    appmetrics.attach();
    this.enabled = true;
  }
}
