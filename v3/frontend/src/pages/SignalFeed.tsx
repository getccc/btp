import { Result } from 'antd';
import { RadarChartOutlined } from '@ant-design/icons';

export default function SignalFeed() {
  return (
    <div className="page-container" style={{ paddingTop: 80 }}>
      <Result
        icon={<RadarChartOutlined style={{ color: '#1677ff' }} />}
        title="Signal Feed — Coming in Phase 2"
        subTitle="Real-time aggregated signals from KOLs, smart money wallets, and Telegram groups will stream here."
      />
    </div>
  );
}
