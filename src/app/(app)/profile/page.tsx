
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useApp } from '@/app/(app)/layout';
import { uploadProfilePhoto, changePassword } from '@/lib/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  Loader2, User, KeyRound, Save, CheckCircle2, XCircle,
  Eye, EyeOff, Trash2
} from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ProfileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  university: z.enum(['Boston College', 'Vanderbilt'], { required_error: 'University is required.' }),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], { required_error: 'Gender is required.' }),
  campusArea: z.string().optional(),
  // Client-side File validation only
  // @ts-expect-error: File exists in the browser
  photo: z.instanceof(File).optional()
    .refine((f) => !f || f.size <= MAX_FILE_SIZE, 'Max file size is 5MB.')
    .refine((f) => !f || ACCEPTED_IMAGE_TYPES.includes(f.type), 'Only .jpg, .png, and .webp are supported.'),
});
type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const PasswordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters long.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
  confirmNewPassword: z.string(),
}).refine(d => d.currentPassword !== d.newPassword, {
  message: 'New password must be different from the current one.',
  path: ['newPassword'],
}).refine(d => d.newPassword === d.confirmNewPassword, {
  message: "New passwords don't match",
  path: ['confirmNewPassword'],
});
type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
  return (
    <div className={cn('flex items-center text-sm', meets ? 'text-green-600' : 'text-muted-foreground')}>
      {meets ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
      {label}
    </div>
  );
}

export default function ProfilePage() {
  const { userProfile: user, refreshUserProfile } = useApp();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      name: '',
      university: 'Boston College',
      gender: 'Prefer not to say',
      campusArea: '',
      photo: undefined,
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name,
        university: (user.university as 'Boston College' | 'Vanderbilt') ?? 'Boston College',
        gender: (user.gender as any) || 'Prefer not to say',
        campusArea: user.campusArea || '',
        photo: undefined,
      });
      setPhotoPreview(user.photoUrl || null);
      setIsLoading(false);
    }
  }, [user, profileForm]);

  const watchedUniversity = profileForm.watch('university');
  const watchedNewPassword = passwordForm.watch('newPassword');

  const passwordRequirements = useMemo(() => {
    const pass = watchedNewPassword || '';
    return [
      { label: 'At least 8 characters', meets: pass.length >= 8 },
      { label: 'Contains a lowercase letter', meets: /[a-z]/.test(pass) },
      { label: 'Contains an uppercase letter', meets: /[A-Z]/.test(pass) },
      { label: 'Contains a number', meets: /[0-9]/.test(pass) },
    ];
  }, [watchedNewPassword]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      profileForm.setValue('photo', f, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  // ---------- Save Profile ----------
  const handleProfileSubmit = async (data: ProfileFormValues) => {
    let photoUrl: string | undefined;

    try {
      // 1) Try uploading photo (if any) with a timeout safety
      if (data.photo instanceof File) {
        try {
          photoUrl = await uploadProfilePhoto(user!.id, data.photo);
        } catch (err: any) {
          // If upload fails or times out, notify and allow saving other fields anyway
          console.error('Photo upload failed:', err);
          toast({
            title: 'Photo upload failed',
            description: err?.message ?? 'Saving your other changes without the new photo.',
            variant: 'destructive',
          });
        }
      }

      // 2) PATCH profile JSON (always time-bound)
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000); // 15s network guard

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: data.name,
          university: data.university,
          gender: data.gender,
          campusArea: data.university === 'Boston College' ? data.campusArea || '' : '',
          ...(photoUrl ? { photoUrl } : {}),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update profile.');
      }

      toast({ title: 'Success!', description: 'Profile updated.' });
      await refreshUserProfile();
      if (photoUrl) setPhotoPreview(photoUrl);
    } catch (err: any) {
      console.error('Profile update failed:', err);
      toast({
        title: 'Update failed',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    }
    // IMPORTANT: allow the submit handler to finish no matter what.
    // RHF will automatically unset isSubmitting when this Promise resolves.
  };

  // ---------- Change Password ----------
  const handlePasswordSubmit = async (vals: PasswordFormValues) => {
    try {
      await changePassword(vals.currentPassword, vals.newPassword);
      toast({ title: 'Password updated', description: 'You may be asked to reauthenticate later.' });
      passwordForm.reset();
    } catch (err: any) {
      toast({
        title: 'Password update failed',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // ---------- Delete Account (optional) ----------
  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete account.');
      toast({ title: 'Account deleted', description: 'We’re sad to see you go.' });
      if (typeof window !== 'undefined') window.location.href = '/login?deleted=true';
    } catch (err: any) {
      toast({ title: 'Deletion failed', description: err?.message ?? 'Please try again.', variant: 'destructive' });
      setIsDeleting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: summary card */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-lg">
            <CardHeader className="items-center text-center p-6">
              <Avatar className="h-28 w-28 border-4 border-primary shadow-md">
                <AvatarImage src={photoPreview || undefined} alt={user.name} />
                <AvatarFallback className="text-4xl">{(user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
              </Avatar>
              <CardTitle className="text-2xl mt-4 font-headline">{user.name}</CardTitle>
              <CardDescription className="text-muted-foreground">{user.university}</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Right: forms */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                  <div>
                    <div>
                      <h3 className="text-xl font-headline flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" /> Edit Profile
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1">Keep your information up to date.</p>
                    </div>

                    <div className="space-y-4 pt-4">
                      {/* Email (display) */}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <p className="text-sm text-foreground/90">{user.email}</p>
                      </div>

                      {/* Photo */}
                      <FormField
                        control={profileForm.control}
                        name="photo"
                        render={() => (
                          <FormItem>
                            <FormLabel>Profile Photo</FormLabel>
                            <FormControl>
                              <input
                                id="photo"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                onChange={handleFileChange}
                              />
                            </FormControl>
                            <FormDescription>Accepted: JPG, PNG, WEBP. Max 5MB.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Name */}
                      <FormField
                        control={profileForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* University */}
                      <FormField
                        control={profileForm.control}
                        name="university"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>University</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled>
                              <FormControl>
                                <SelectTrigger id="university">
                                  <SelectValue placeholder="Select University" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Boston College">Boston College</SelectItem>
                                <SelectItem value="Vanderbilt">Vanderbilt</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Campus (BC only) */}
                      {watchedUniversity === 'Boston College' && (
                        <FormField
                          control={profileForm.control}
                          name="campusArea"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Boston College Campus Area</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                  <SelectTrigger id="campusArea">
                                    <SelectValue placeholder="Select BC Campus Area" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="2k">2k</SelectItem>
                                  <SelectItem value="Newton">Newton</SelectItem>
                                  <SelectItem value="CoRo/Upper">CoRo/Upper (College Road/Upper)</SelectItem>
                                  <SelectItem value="Lower">Lower</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Gender */}
                      <FormField
                        control={profileForm.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger id="gender">
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                                <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {profileForm.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
                  </Button>
                </form>
              </Form>

              <Separator className="my-8" />

              {/* Change Password */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-headline flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" /> Change Password
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    For your security, you may be asked to reauthenticate.
                  </p>
                </div>

                <form onSubmit={passwordForm.handleSubmit(async (vals) => handlePasswordSubmit(vals))} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input id="currentPassword" type={showCurrentPassword ? 'text' : 'password'} {...passwordForm.register('currentPassword')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowCurrentPassword(v => !v)}>
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-destructive text-sm">{passwordForm.formState.errors.currentPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} {...passwordForm.register('newPassword')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowNewPassword(v => !v)}>
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-destructive text-sm">{passwordForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input id="confirmNewPassword" type={showConfirmNewPassword ? 'text' : 'password'} {...passwordForm.register('confirmNewPassword')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowConfirmNewPassword(v => !v)}>
                        {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordForm.formState.errors.confirmNewPassword && (
                      <p className="text-destructive text-sm">{passwordForm.formState.errors.confirmNewPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 rounded-md border p-3 shadow-sm">
                    {passwordRequirements.map((req, i) => (
                      <PasswordRequirement key={i} meets={req.meets} label={req.label} />
                    ))}
                  </div>

                  <Button type="submit" variant="secondary" disabled={!passwordForm.formState.isValid || passwordForm.formState.isSubmitting}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    {passwordForm.formState.isSubmitting ? 'Updating…' : 'Update Password'}
                  </Button>
                </form>
              </div>

              <Separator className="my-8" />

              {/* Delete account (optional) */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-headline flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" /> Delete Account
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">Permanently delete your account and all associated data.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : 'Delete My Account'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and related data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                        Yes, delete my account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

    