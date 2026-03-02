import { Result } from 'antd';
import { AimOutlined } from '@ant-design/icons';

export default function OpportunityList() {
  return (
    <div className="page-container" style={{ paddingTop: 80 }}>
      <Result
        icon={<AimOutlined style={{ color: '#1677ff' }} />}
        title="Opportunities — Coming in Phase 3"
        subTitle="Scored and ranked trading opportunities with multi-source confirmation will appear here."
      />
    </div>
  );
}
