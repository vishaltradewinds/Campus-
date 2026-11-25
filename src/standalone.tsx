import React from 'react';
import {createRoot} from 'react-dom/client';
import {StandaloneStakeholderAcceptance} from './components/StandaloneStakeholderAcceptance';
import {StandaloneDashboardAcceptance} from './components/StandaloneDashboardAcceptance';
import './index.css';
// Explicit standalone build entry; not imported from the active application.
createRoot(document.getElementById('root')!).render(<StandaloneStakeholderAcceptance renderDashboard={(identity,account)=><StandaloneDashboardAcceptance identity={identity} initialAccount={account}/>}/>);
