import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AttackAlerts from '../components/AttackAlerts';

const AttackDetectionMonitorPage = () => {
  const { alerts } = useOutletContext<any>();

  return (
    <div className="h-100 d-flex flex-column">
      <h4 className="text-light mb-4">Security Threat Monitor</h4>
      <AttackAlerts alerts={alerts || []} />
    </div>
  );
};

export default AttackDetectionMonitorPage;
