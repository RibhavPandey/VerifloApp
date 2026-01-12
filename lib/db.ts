
import { supabase } from './supabase';
import { Job, ExcelFile, Workflow, VerificationDocument } from '../types';

export const db = {
  // --- PROFILES & CREDITS ---
  async getUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Try to fetch existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // 2. If not found (code PGRST116), try to create one
    if (error && error.code === 'PGRST116') {
        console.log("Profile not found, creating new profile...");
        const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({ 
                id: user.id, 
                credits: 500, 
                email: user.email 
            })
            .select()
            .single();
        
        if (createError) {
             console.error('Error creating profile:', createError);
             // If RLS denies insert, we return a fallback but log clearly
             if (createError.code === '42501') {
                 console.error("CRITICAL: RLS Policy missing. Please run the contents of supabase_setup.sql in your Supabase SQL Editor.");
             }
             return { credits: 500 }; 
        }
        return newProfile;
    }
    
    // 3. Other errors
    if (error) {
        console.error('Error fetching profile:', error);
        return { credits: 500 }; 
    }

    return data;
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

    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id) // Explicitly filter by user_id for safety, though RLS handles it
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error fetching jobs:", error);
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
  },

  async upsertJob(job: Job) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Note: risky_count column may not exist in database schema
    // Only include fields that exist in the schema
    const { error } = await supabase.from('jobs').upsert({
      id: job.id,
      user_id: user.id,
      title: job.title,
      type: job.type,
      status: job.status,
      file_ids: job.fileIds,
      config: job.config,
      chat_history: job.chatHistory || [],
      updated_at: new Date().toISOString()
      // risky_count: job.riskyCount, // Removed - column doesn't exist in schema
    });
    if (error) console.error('Error saving job:', error);
  },

  async getJob(jobId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error("Error fetching job:", error);
        return null;
    }

    if (!data) return null;

    return {
      ...data,
      fileIds: data.file_ids,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      chatHistory: data.chat_history || [],
      riskyCount: data.risky_count || undefined // Column may not exist in schema
    } as Job;
  },

  async deleteJob(jobId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user.id);

    if (error) console.error("Error deleting job:", error);
  },

  // --- FILES ---
  async fetchFiles(fileIds: string[]) {
    if (fileIds.length === 0) return [];
    
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .in('id', fileIds);

    if (error) {
        console.error("Error fetching files:", error);
        return [];
    }
    
    return data.map((f: any) => ({
        ...f,
        lastModified: f.last_modified
    })) as ExcelFile[];
  },

  async getFile(fileId: string) {
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();

    if (error) {
        console.error("Error fetching file:", error);
        return null;
    }

    if (!data) return null;

    return {
        ...data,
        lastModified: data.last_modified
    } as ExcelFile;
  },

  async upsertFile(file: ExcelFile, jobId?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // We strip heavy history to save space, keeping only the last 5 snapshots
    const leanHistory = file.history.slice(-5);

    const { error } = await supabase.from('files').upsert({
      id: file.id,
      user_id: user.id,
      name: file.name,
      data: file.data,
      columns: file.columns,
      styles: file.styles,
      history: leanHistory,
      last_modified: Date.now()
    });
    if (error) console.error('Error saving file:', error);
  },

  // --- WORKFLOWS ---
  async fetchWorkflows() {
    const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching workflows:", error);
        return [];
    }
    
    return data.map((w: any) => ({
        ...w,
        sourceType: w.source_type,
        lastRun: w.last_run,
        lastRunStatus: w.last_run_status,
        createdAt: w.created_at
    })) as Workflow[];
  },

  async upsertWorkflow(workflow: Workflow) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('workflows').upsert({
      id: workflow.id,
      user_id: user.id,
      name: workflow.name,
      source_type: workflow.sourceType,
      steps: workflow.steps,
      last_run: workflow.lastRun,
      last_run_status: workflow.lastRunStatus,
      created_at: workflow.createdAt
    });
    if (error) console.error('Error saving workflow:', error);
  },

  // --- VERIFICATION DOCS ---
  async fetchVerificationDocs(ids: string[]) {
      if(ids.length === 0) return [];
      const { data, error } = await supabase.from('verification_docs').select('*').in('id', ids);
      if(error) throw error;
      
      return data.map((d: any) => ({
          ...d,
          fileName: d.file_name,
          mimeType: d.mime_type,
          fileData: d.file_data
      })) as VerificationDocument[];
  },

  async upsertVerificationDoc(doc: VerificationDocument) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('verification_docs').upsert({
          id: doc.id,
          user_id: user.id,
          file_name: doc.fileName,
          mime_type: doc.mimeType,
          file_data: doc.fileData,
          fields: doc.fields,
          status: doc.status
      });
      if(error) console.error('Error saving doc', error);
  }
};
