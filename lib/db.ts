
import { supabase } from './supabase';
import { Job, ExcelFile, Workflow, VerificationDocument } from '../types';
import { withRetry, parseDbError, isTransientError } from './db-utils';

export const db = {
  // --- PROFILES & CREDITS ---
  async getUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      // 1. Try to fetch existing profile with retry
      const { data, error } = await withRetry(async () => {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });
      
      // 2. If not found (code PGRST116), try to create one
      if (error && error.code === 'PGRST116') {
          console.log("Profile not found, creating new profile...");
          const { data: newProfile, error: createError } = await withRetry(async () => {
            const result = await supabase
                .from('profiles')
                .insert({ 
                    id: user.id, 
                    credits: 200, 
                    email: user.email 
                })
                .select()
                .single();
            if (result.error && !isTransientError(result.error)) {
              throw result.error;
            }
            return result;
          });
          
          if (createError) {
               const dbError = parseDbError(createError);
               console.error('Error creating profile:', dbError);
               // If RLS denies insert, we return a fallback but log clearly
               if (createError.code === '42501') {
                   console.error("CRITICAL: RLS Policy missing. Please run the contents of supabase_setup.sql in your Supabase SQL Editor.");
               }
               return { credits: 200 }; 
          }
          return newProfile;
      }
      
      // 3. Other errors
      if (error) {
          const dbError = parseDbError(error);
          console.error('Error fetching profile:', dbError);
          // For transient errors, throw to be handled by caller
          if (dbError.isTransient) {
            throw new Error(dbError.message);
          }
          return { credits: 200 }; 
      }

      return data;
    } catch (error: any) {
      const dbError = parseDbError(error);
      console.error('Failed to get user profile after retries:', dbError);
      // Return fallback profile on persistent errors
      return { credits: 200 };
    }
  },

  async decrementCredits(amount: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Fetch current to ensure we don't go negative on the server side check (optional but good practice)
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
    
    if (profile) {
        const newBalance = Math.max(0, profile.credits - amount);
        const { error } = await supabase
            .from('profiles')
            .update({ credits: newBalance })
            .eq('id', user.id);
            
        if (error) console.error("Error updating credits:", error);
    }
  },

  // --- JOBS ---
  async fetchJobs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await withRetry(async () => {
        const result = await supabase
            .from('jobs')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
          const dbError = parseDbError(error);
          console.error("Error fetching jobs:", dbError);
          if (dbError.isTransient) {
            throw new Error(dbError.message);
          }
          return [];
      }
      
      return data.map((j: any) => ({
        ...j,
        fileIds: j.file_ids,
        createdAt: new Date(j.created_at).getTime(),
        updatedAt: new Date(j.updated_at).getTime(),
        chatHistory: j.chat_history || [],
        riskyCount: j.risky_count
      })) as Job[];
    } catch (error: any) {
      const dbError = parseDbError(error);
      console.error("Failed to fetch jobs after retries:", dbError);
      throw new Error(`Failed to load projects: ${dbError.message}`);
    }
  },

  async upsertJob(job: Job) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    try {
      const { error } = await withRetry(async () => {
        const result = await supabase.from('jobs').upsert({
          id: job.id,
          user_id: user.id,
          title: job.title,
          type: job.type,
          status: job.status,
          file_ids: job.fileIds,
          config: job.config,
          chat_history: job.chatHistory || [],
          updated_at: new Date().toISOString()
        });
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });
      
      if (error) {
        const dbError = parseDbError(error);
        console.error('Error saving job:', dbError);
        if (dbError.isTransient) {
          throw new Error(`Failed to save project: ${dbError.message}`);
        }
        throw new Error(`Failed to save project: ${dbError.message}`);
      }
    } catch (error: any) {
      const dbError = parseDbError(error);
      throw new Error(`Failed to save project: ${dbError.message}`);
    }
  },

  async getJob(jobId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data, error } = await withRetry(async () => {
        const result = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .eq('user_id', user.id)
            .single();
        if (result.error && !isTransientError(result.error) && result.error.code !== 'PGRST116') {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        if (error.code === 'PGRST116') {
          // Not found is expected
          return null;
        }
        console.error("Error fetching job:", dbError);
        if (dbError.isTransient) {
          throw new Error(`Failed to load project: ${dbError.message}`);
        }
        return null;
      }

      if (!data) return null;

      return {
        ...data,
        fileIds: data.file_ids,
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: new Date(data.updated_at).getTime(),
        chatHistory: data.chat_history || [],
        riskyCount: data.risky_count || undefined
      } as Job;
    } catch (error: any) {
      const dbError = parseDbError(error);
      console.error("Failed to get job after retries:", dbError);
      throw new Error(`Failed to load project: ${dbError.message}`);
    }
  },

  async deleteJob(jobId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { error } = await withRetry(async () => {
        const result = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('user_id', user.id);
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        console.error("Error deleting job:", dbError);
        throw new Error(`Failed to delete project: ${dbError.message}`);
      }
    } catch (error: any) {
      const dbError = parseDbError(error);
      throw new Error(`Failed to delete project: ${dbError.message}`);
    }
  },

  // --- FILES ---
  async fetchFiles(fileIds: string[]) {
    if (fileIds.length === 0) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    try {
      const { data, error } = await withRetry(async () => {
        const result = await supabase
            .from('files')
            .select('*')
            .in('id', fileIds)
            .eq('user_id', user.id);
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        console.error("Error fetching files:", dbError);
        if (dbError.isTransient) {
          throw new Error(`Failed to load files: ${dbError.message}`);
        }
        return [];
      }
      
      return data.map((f: any) => ({
          ...f,
          lastModified: f.last_modified
      })) as ExcelFile[];
    } catch (error: any) {
      const dbError = parseDbError(error);
      console.error("Failed to fetch files after retries:", dbError);
      throw new Error(`Failed to load files: ${dbError.message}`);
    }
  },

  async getFile(fileId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const { data, error } = await withRetry(async () => {
        const result = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .eq('user_id', user.id)
            .single();
        if (result.error && !isTransientError(result.error) && result.error.code !== 'PGRST116') {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error("Error fetching file:", dbError);
        if (dbError.isTransient) {
          throw new Error(`Failed to load file: ${dbError.message}`);
        }
        return null;
      }

      if (!data) return null;

      return {
          ...data,
          lastModified: data.last_modified
      } as ExcelFile;
    } catch (error: any) {
      const dbError = parseDbError(error);
      console.error("Failed to get file after retries:", dbError);
      throw new Error(`Failed to load file: ${dbError.message}`);
    }
  },

  async upsertFile(file: ExcelFile, jobId?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      // We strip heavy history to save space, keeping only the last 5 snapshots
      const leanHistory = file.history.slice(-5);

      const { error } = await withRetry(async () => {
        const result = await supabase.from('files').upsert({
          id: file.id,
          user_id: user.id,
          name: file.name,
          data: file.data,
          columns: file.columns,
          styles: file.styles,
          history: leanHistory,
          last_modified: Date.now()
        });
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        console.error('Error saving file:', dbError);
        throw new Error(`Failed to save file: ${dbError.message}`);
      }
    } catch (error: any) {
      const dbError = parseDbError(error);
      throw new Error(`Failed to save file: ${dbError.message}`);
    }
  },

  // --- WORKFLOWS ---
  async fetchWorkflows() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await withRetry(async () => {
        const result = await supabase
            .from('workflows')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        console.error("Error fetching workflows:", dbError);
        if (dbError.isTransient) {
          throw new Error(`Failed to load workflows: ${dbError.message}`);
        }
        return [];
      }
      
      return data.map((w: any) => ({
          ...w,
          sourceType: w.source_type,
          lastRun: w.last_run,
          lastRunStatus: w.last_run_status,
          createdAt: w.created_at
      })) as Workflow[];
    } catch (error: any) {
      const dbError = parseDbError(error);
      console.error("Failed to fetch workflows after retries:", dbError);
      throw new Error(`Failed to load workflows: ${dbError.message}`);
    }
  },

  async upsertWorkflow(workflow: Workflow) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { error } = await withRetry(async () => {
        const result = await supabase.from('workflows').upsert({
          id: workflow.id,
          user_id: user.id,
          name: workflow.name,
          source_type: workflow.sourceType,
          steps: workflow.steps,
          last_run: workflow.lastRun,
          last_run_status: workflow.lastRunStatus,
          created_at: workflow.createdAt
        });
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        console.error('Error saving workflow:', dbError);
        throw new Error(`Failed to save workflow: ${dbError.message}`);
      }
    } catch (error: any) {
      const dbError = parseDbError(error);
      throw new Error(`Failed to save workflow: ${dbError.message}`);
    }
  },

  async deleteWorkflow(workflowId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { error } = await withRetry(async () => {
        const result = await supabase
            .from('workflows')
            .delete()
            .eq('id', workflowId)
            .eq('user_id', user.id);
        if (result.error && !isTransientError(result.error)) {
          throw result.error;
        }
        return result;
      });

      if (error) {
        const dbError = parseDbError(error);
        console.error("Error deleting workflow:", dbError);
        throw new Error(`Failed to delete workflow: ${dbError.message}`);
      }
    } catch (error: any) {
      const dbError = parseDbError(error);
      throw new Error(`Failed to delete workflow: ${dbError.message}`);
    }
  },

  // --- VERIFICATION DOCS ---
  async fetchVerificationDocs(ids: string[]) {
      if(ids.length === 0) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      try {
        const { data, error } = await withRetry(async () => {
          const result = await supabase
            .from('verification_docs')
            .select('*')
            .in('id', ids)
            .eq('user_id', user.id);
          if (result.error && !isTransientError(result.error)) {
            throw result.error;
          }
          return result;
        });

        if (error) {
          const dbError = parseDbError(error);
          console.error("Error fetching verification docs:", dbError);
          throw new Error(`Failed to load documents: ${dbError.message}`);
        }
        
        return data.map((d: any) => ({
            ...d,
            fileName: d.file_name,
            mimeType: d.mime_type,
            fileData: d.file_data,
            lineItems: d.line_items ?? d.lineItems
        })) as VerificationDocument[];
      } catch (error: any) {
        const dbError = parseDbError(error);
        throw new Error(`Failed to load documents: ${dbError.message}`);
      }
  },

  async upsertVerificationDoc(doc: VerificationDocument) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      try {
        const { error } = await withRetry(async () => {
          const result = await supabase.from('verification_docs').upsert({
              id: doc.id,
              user_id: user.id,
              file_name: doc.fileName,
              mime_type: doc.mimeType,
              file_data: doc.fileData,
              fields: doc.fields,
              line_items: doc.lineItems,
              status: doc.status
          });
          if (result.error && !isTransientError(result.error)) {
            throw result.error;
          }
          return result;
        });

        if (error) {
          const dbError = parseDbError(error);
          console.error('Error saving doc', dbError);
          throw new Error(`Failed to save document: ${dbError.message}`);
        }
      } catch (error: any) {
        const dbError = parseDbError(error);
        throw new Error(`Failed to save document: ${dbError.message}`);
      }
  }
};
