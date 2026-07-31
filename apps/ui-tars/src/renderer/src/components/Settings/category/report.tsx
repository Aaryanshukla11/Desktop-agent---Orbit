/**
 
 */
import { useEffect } from 'react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useSetting } from '@renderer/hooks/useSetting';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import { Input } from '@renderer/components/ui/input';

const formSchema = z.object({
  reportStorageBaseUrl: z.string().optional(),
  utioBaseUrl: z.string().optional(),
});

export interface VLMSettingsRef {
  submit: () => Promise<z.infer<typeof formSchema>>;
}

export function ReportSettings() {
  const { settings, updateSetting } = useSetting();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportStorageBaseUrl: '',
      utioBaseUrl: '',
    },
  });

  const [newReportUrl, newUtioUrl] = form.watch([
    'reportStorageBaseUrl',
    'utioBaseUrl',
  ]);

  useEffect(() => {
    if (Object.keys(settings).length) {
      form.reset({
        reportStorageBaseUrl: settings.reportStorageBaseUrl,
        utioBaseUrl: settings.utioBaseUrl,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    if (!Object.keys(settings).length) {
      return;
    }
    if (newReportUrl === '' && newUtioUrl === '') {
      return;
    }

    const validAndSave = async () => {
      const isReportValid = await form.trigger('reportStorageBaseUrl');
      if (isReportValid && newReportUrl !== settings.reportStorageBaseUrl) {
        updateSetting({ ...settings, reportStorageBaseUrl: newReportUrl });
      }

      const isUTIOValid = await form.trigger('utioBaseUrl');
      if (isUTIOValid && newUtioUrl !== settings.utioBaseUrl) {
        updateSetting({ ...settings, utioBaseUrl: newUtioUrl });
      }
    };

    validAndSave();
  }, [newReportUrl, newUtioUrl, settings, updateSetting, form]);

  return (
    <>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 mb-4">
        🔒 <strong>Privacy Mode Active:</strong> Orbit Beta runs completely standalone. Remote telemetry and automatic background reporting have been permanently disabled. Exported task reports are saved directly to your local computer.
      </div>
      <Form {...form}>
        <form className="space-y-8">
          {/* Report Settings Fields */}
          <FormField
            control={form.control}
            name="reportStorageBaseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Report Storage Base URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://your-report-storage-endpoint.com/upload"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* UTIO Base URL */}
          <FormField
            control={form.control}
            name="utioBaseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UTIO Base URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://your-utio-endpoint.com/collect"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </>
  );
}
