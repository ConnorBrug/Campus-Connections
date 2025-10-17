
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { uploadProfilePhoto, changePassword } from '@/lib/auth';
import type { UserProfile } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound, ShieldCheck, Save, CheckCircle2, XCircle, Trash2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useApp } from '@/app/(app)/layout';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ProfileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  campusArea: z.string().optional(),
  photo: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, 'Max file size is 5MB.')
    .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), 'Only .jpg, .png, and .webp formats are supported.'),
});
type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const PasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters.')
      .regex(/[a-z]/, 'Must contain a lowercase letter.')
      .regex(/[A-Z]/, 'Must contain an uppercase letter.')
      .regex(/[0-9]/, 'Must contain a number.'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from the current one.',
    path: ['newPassword'],
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "New passwords don't match",
    path: ['confirmNewPassword'],
  });
type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cn('flex items-center text-sm', ok ? 'text-green-600' : 'text-muted-foreground')}>
      {ok ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
      {label}
    </div>
  );
}

export default function ProfilePage() {
  const { toast } = useToast();
  const { userProfile: user, refreshUserProfile } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      name: '',
      gender: 'Prefer not to say',
      campusArea: '',
      photo: undefined,
    },
  });

  const passForm = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const watchedNew = passForm.watch('newPassword');
  const reqs = useMemo(() => {
    const p = watchedNew || '';
    return [
      { label: 'At least 8 characters', ok: p.length >= 8 },
      { label: 'Contains a lowercase letter', ok: /[a-z]/.test(p) },
      { label: 'Contains an uppercase letter', ok: /[A-Z]/.test(p) },
      { label: 'Contains a number', ok: /[0-9]/.test(p) },
    ];
  }, [watchedNew]);

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      name: user.name,
      gender: (user.gender as ProfileFormValues['gender']) ?? 'Prefer not to say',
      campusArea: user.campusArea || '',
      photo: undefined,
    });
    if (user.photoUrl) setPhotoPreview(user.photoUrl);
    setIsLoading(false);
  }, [user, profileForm]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    profileForm.setValue('photo', f, { shouldValidate: true });
    const r = new FileReader();
    r.onloadend = () => setPhotoPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const onSubmitProfile = async (vals: ProfileFormValues) => {
    if (!user) return;
    try {
      let photoUrl: string | undefined = undefined;
      if (vals.photo) {
        photoUrl = await uploadProfilePhoto(user.id, vals.photo);
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: vals.name.trim(),
          university: user.university, // Keep original university
          gender: vals.gender,
          campusArea: user.university === 'Boston College' ? (vals.campusArea ?? '') : '',
          ...(photoUrl ? { photoUrl } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Update failed');

      toast({ title: 'Profile updated', description: 'Your profile was saved.' });
      await refreshUserProfile();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message ?? 'Validation failed', variant: 'destructive' });
    }
  };

  const onSubmitPassword = async (vals: PasswordFormValues) => {
    try {
      await changePassword(vals.currentPassword, vals.newPassword);
      toast({ title: 'Password updated', description: 'Please sign in again if prompted.' });
      passForm.reset();
    } catch (e: any) {
      toast({ title: 'Password change failed', description: e.message ?? 'Try again.', variant: 'destructive' });
    }
  };

  const onDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Deletion failed');
      toast({ title: 'Account deleted', description: 'Goodbye! 👋' });
      // Let your auth state listener redirect to /login
    } catch (e: any) {
      toast({ title: 'Deletion failed', description: e.message ?? 'Try again.', variant: 'destructive' });
      setIsDeleting(false);
    }
  };

  const getInitials = (name?: string) => (name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : 'U');

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
        {/* Left: avatar */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-lg">
            <CardHeader className="items-center text-center p-6">
              <Avatar className="h-28 w-28 border-4 border-primary shadow-md">
                <AvatarImage src={photoPreview || undefined} alt={user.name} />
                <AvatarFallback className="text-4xl">{getInitials(user.name)}</AvatarFallback>
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
              {/* PROFILE */}
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-6">
                  <div>
                    <div>
                      <h3 className="text-xl font-headline flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" /> Edit Profile
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1">Keep your information up to date.</p>
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <p className="text-sm text-foreground/90">{user.email}</p>
                      </div>

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
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                onChange={onFile}
                                accept="image/png, image/jpeg, image/webp"
                              />
                            </FormControl>
                            <FormDescription>Accepted: PNG, JPEG, WEBP. Max 5MB.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                       <div className="space-y-2">
                          <Label>University</Label>
                          <Input value={user.university} disabled className="bg-muted/50"/>
                          <FormDescription>Your university cannot be changed after signup.</FormDescription>
                      </div>


                      {user.university === 'Boston College' && (
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
                    {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>

              <Separator className="my-8" />

              {/* PASSWORD */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-headline flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" /> Change Password
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">For your security, you may be logged out after changing your password.</p>
                </div>
                <form onSubmit={passForm.handleSubmit(onSubmitPassword)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input id="currentPassword" type={showCur ? 'text' : 'password'} {...passForm.register('currentPassword')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowCur((v) => !v)}>
                        {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passForm.formState.errors.currentPassword && <p className="text-destructive text-sm">{passForm.formState.errors.currentPassword.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input id="newPassword" type={showNew ? 'text' : 'password'} {...passForm.register('newPassword')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowNew((v) => !v)}>
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passForm.formState.errors.newPassword && <p className="text-destructive text-sm">{passForm.formState.errors.newPassword.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input id="confirmNewPassword" type={showConf ? 'text' : 'password'} {...passForm.register('confirmNewPassword')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowConf((v) => !v)}>
                        {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passForm.formState.errors.confirmNewPassword && <p className="text-destructive text-sm">{passForm.formState.errors.confirmNewPassword.message}</p>}
                  </div>

                  <div className="space-y-1 rounded-md border p-3 shadow-sm">
                    {reqs.map((r, i) => (
                      <Requirement key={i} ok={r.ok} label={r.label} />
                    ))}
                  </div>

                  <Button type="submit" variant="secondary" disabled={!passForm.formState.isValid || passForm.formState.isSubmitting}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {passForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </div>

              <Separator className="my-8" />

              {/* DELETE ACCOUNT */}
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
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                        </>
                      ) : (
                        'Delete My Account'
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account, your profile, and remove you from any matched trips.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onDelete}>
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

    