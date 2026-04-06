import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type AppConfig = {
  terms_url: string;
  privacy_url: string;
  tc_version: string;
};

const DEFAULTS: AppConfig = {
  terms_url: 'https://wordifi.com/terms',
  privacy_url: 'https://wordifi.com/privacy',
  tc_version: '1.0',
};

export const [AppConfigProvider, useAppConfig] = createContextHook((): AppConfig => {
  const [config, setConfig] = useState<AppConfig>(DEFAULTS);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await (supabase.from('app_config' as never) as any)
          .select('key, value')
          .in('key', ['terms_url', 'privacy_url', 'tc_version']);
        if (!data || !Array.isArray(data)) return;
        const map: Record<string, string> = {};
        for (const row of data as Array<{ key: string; value: string }>) {
          map[row.key] = row.value;
        }
        setConfig({
          terms_url: map.terms_url ?? DEFAULTS.terms_url,
          privacy_url: map.privacy_url ?? DEFAULTS.privacy_url,
          tc_version: map.tc_version ?? DEFAULTS.tc_version,
        });
      } catch {
        // silently use defaults
      }
    })();
  }, []);

  return useMemo(() => config, [config]);
});
