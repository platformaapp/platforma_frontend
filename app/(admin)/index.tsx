import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getAdminToken } from '@/lib/admin-auth';

export default function AdminIndex() {
  const [checked, setChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    getAdminToken().then((token) => {
      setHasToken(!!token);
      setChecked(true);
    });
  }, []);

  if (!checked) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  return <Redirect href={hasToken ? '/(admin)/dashboard' : '/(admin)/login'} />;
}
