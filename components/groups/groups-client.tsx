'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Search, Users, ChevronRight, Loader2, X
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn, SUPPORTED_CURRENCIES } from '@/lib/utils';

const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(60),
  description: z.string().max(200).optional(),
  currency_code: z.string().min(3).max(3),
});

type CreateGroupForm = z.infer<typeof createGroupSchema>;

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  currency_code: string;
  created_by: string;
  role: string;
  user_balance_minor: number;
  member_count: number;
  members?: { user_id: string; profile?: { id: string; display_name: string; username: string; avatar_url: string | null } }[];
}

export function GroupsClient({ userId, groups }: { userId: string; groups: GroupData[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const supabase = createClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { currency_code: 'USD' },
  });

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const onCreateGroup = async (data: CreateGroupForm) => {
    setCreating(true);
    setCreateError(null);

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: data.name,
        description: data.description || null,
        currency_code: data.currency_code,
        created_by: userId,
      })
      .select()
      .single();

    setCreating(false);

    if (error) {
      setCreateError(error.message);
      return;
    }

    reset();
    setShowCreate(false);
    router.push(`/groups/${group.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 text-stone-900">Groups</h1>
          <p className="text-stone-500 text-sm mt-0.5">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary text-sm"
          id="create-group-btn"
        >
          <Plus size={16} />
          New Group
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
          id="group-search"
        />
      </div>

      {/* Groups grid */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Users size={36} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">
            {search ? 'No groups found' : 'No groups yet'}
          </p>
          {!search && (
            <p className="text-stone-400 text-sm mt-1">
              Create a group to start splitting expenses with friends.
            </p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) => (
            <GroupCard key={group.id} group={group} userId={userId} />
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-stone-900">Create Group</h2>
              <button
                onClick={() => { setShowCreate(false); reset(); setCreateError(null); }}
                className="btn-ghost p-2"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onCreateGroup)} className="space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm">
                  {createError}
                </div>
              )}

              <div>
                <label className="label">Group name</label>
                <input
                  id="group-name-input"
                  type="text"
                  className={cn('input', errors.name && 'input-error')}
                  placeholder="Trip to Italy, Apartment, etc."
                  {...register('name')}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="What's this group for?"
                  {...register('description')}
                />
              </div>

              <div>
                <label className="label">Currency</label>
                <select className="input" {...register('currency_code')}>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); reset(); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary flex-1"
                  id="confirm-create-group-btn"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, userId }: { group: GroupData; userId: string }) {
  const balance = group.user_balance_minor;
  const members = group.members?.slice(0, 4) ?? [];

  return (
    <Link
      href={`/groups/${group.id}`}
      className="card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer"
      id={`group-card-${group.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-900 truncate">{group.name}</h3>
          {group.description && (
            <p className="text-xs text-stone-400 mt-0.5 truncate">{group.description}</p>
          )}
        </div>
        <ChevronRight size={16} className="text-stone-300 shrink-0 mt-0.5" />
      </div>

      {/* Member avatars */}
      <div className="flex items-center gap-2">
        <div className="avatar-group">
          {members.map((m) => {
            const profile = m.profile;
            const color = generateAvatarColor(m.user_id);
            return (
              <div
                key={m.user_id}
                title={profile?.display_name}
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold"
                style={{ backgroundColor: color }}
              >
                {getInitials(profile?.display_name ?? '?')}
              </div>
            );
          })}
          {group.member_count > 4 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600">
              +{group.member_count - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-stone-400">{group.member_count} members</span>
      </div>

      {/* Balance */}
      <div className={cn(
        'text-sm font-semibold px-2.5 py-1.5 rounded-lg text-center',
        balance > 0
          ? 'bg-emerald-50 text-emerald-700'
          : balance < 0
          ? 'bg-red-50 text-red-700'
          : 'bg-stone-50 text-stone-500'
      )}>
        {balance === 0
          ? 'Settled up'
          : balance > 0
          ? `You're owed ${formatCurrency(balance, group.currency_code)}`
          : `You owe ${formatCurrency(Math.abs(balance), group.currency_code)}`}
      </div>
    </Link>
  );
}
