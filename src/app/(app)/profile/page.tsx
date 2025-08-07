
'use client';

import { useState, useEffect, useActionState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateUserProfileAction, ProfileUpdateFormState, changePasswordAction, ChangePasswordFormState, deleteAccountAction } from '@/lib/actions';
import { getCurrentUser } from '@/lib/auth';
import type { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound, ShieldCheck, Save, CheckCircle2, XCircle, Trash2, Eye, EyeOff, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useApp } from '@/app/(app)/layout';


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ProfileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  university: z.string().min(3, "University name is required."),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  campusArea: z.string().optional(),
  photo: z.instanceof(File)
    .optional()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .png, and .webp formats are supported."
    ),
});
type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const PasswordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string()
    .min(8, "New password must be at least 8 characters long.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
  confirmNewPassword: z.string(),
}).refine(data => data.currentPassword !== data.newPassword, {
  message: "New password must be different from the current one.",
  path: ['newPassword'],
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: "New passwords don't match",
    path: ["confirmNewPassword"],
});
type PasswordFormValues = z.infer<typeof PasswordFormSchema>;


function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
    return (
        <div className={cn("flex items-center text-sm", meets ? "text-green-600" : "text-muted-foreground")}>
            {meets ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
            {label}
        </div>
    );
}

export default function ProfilePage() {
  const { toast } = useToast();
  const { userProfile: user, refreshUserProfile } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const initialProfileState: ProfileUpdateFormState = { message: undefined, errors: undefined };
  const [profileState, dispatchProfileUpdate] = useActionState(updateUserProfileAction, initialProfileState);
  
  const initialPasswordState: ChangePasswordFormState = { message: undefined, errors: undefined };
  const [passwordState, dispatchPasswordChange] = useActionState(changePasswordAction, initialPasswordState);


  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      name: '',
      university: '',
      gender: 'Prefer not to say',
      campusArea: '',
      photo: undefined,
    }
  });
  
  const passwordForm = useForm<PasswordFormValues>({
      resolver: zodResolver(PasswordFormSchema),
      mode: 'onChange',
      defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });
  
  const watchedNewPassword = passwordForm.watch('newPassword');

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name,
        university: user.university,
        gender: user.gender,
        campusArea: user.campusArea || '',
      });
      if(user.photoUrl) {
        setPhotoPreview(user.photoUrl);
      }
      setIsLoading(false);
    }
  }, [user, profileForm]);
  
  useEffect(() => {
    if (profileState?.message) {
      toast({
        title: profileState.errors ? 'Update Failed' : 'Success!',
        description: profileState.message,
        variant: profileState.errors ? 'destructive' : 'default',
      });
      if (!profileState.errors) {
        refreshUserProfile();
      }
    }
  }, [profileState, toast, refreshUserProfile]);

  useEffect(() => {
    if (passwordState?.message) {
      toast({
        title: passwordState.errors ? 'Error' : 'Success!',
        description: passwordState.message,
        variant: passwordState.errors ? 'destructive' : 'default',
      });
      if (!passwordState.errors) {
        passwordForm.reset();
      }
    }
  }, [passwordState, toast, passwordForm]);

  const handleProfileSubmit = (data: ProfileFormValues) => {
    if (!user) return;
    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('name', data.name);
    formData.append('university', data.university);
    formData.append('gender', data.gender);
    if (data.campusArea) {
      formData.append('campusArea', data.campusArea);
    }
    if (data.photo) {
      formData.append('photo', data.photo);
    }
    dispatchProfileUpdate(formData);
  };
  
  const handlePasswordSubmit = (data: PasswordFormValues) => {
      const formData = new FormData();
      formData.append('currentPassword', data.currentPassword);
      formData.append('newPassword', data.newPassword);
      formData.append('confirmNewPassword', data.confirmNewPassword);
      dispatchPasswordChange(formData);
  };
  
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const result = await deleteAccountAction();
    if (!result.success) {
        toast({
            title: 'Deletion Failed',
            description: result.message,
            variant: 'destructive',
        });
        setIsDeleting(false);
    } else {
        toast({
            title: 'Account Deleted',
            description: 'Your account has been successfully deleted.',
        });
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      profileForm.setValue("photo", file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const passwordRequirements = useMemo(() => {
    const pass = watchedNewPassword || '';
    return [
      { label: "At least 8 characters", meets: pass.length >= 8 },
      { label: "Contains a lowercase letter", meets: /[a-z]/.test(pass) },
      { label: "Contains an uppercase letter", meets: /[A-Z]/.test(pass) },
      { label: "Contains a number", meets: /[0-9]/.test(pass) }
    ];
  }, [watchedNewPassword]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const watchedUniversity = profileForm.watch('university');

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Profile Card */}
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

        {/* Right Column: Edit Forms */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                  {/* --- EDIT PROFILE SECTION --- */}
                  <div>
                    <div>
                      <h3 className="text-xl font-headline flex items-center gap-2"><User className="h-5 w-5 text-primary"/> Edit Profile</h3>
                      <p className="text-muted-foreground text-sm mt-1">Keep your information up to date.</p>
                    </div>
                    <div className="space-y-4 pt-4">
                       <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <p className="text-sm text-foreground/90">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Although your email cannot be changed, you can always create a new account with us and discard your current one by using the delete account feature below.
                        </p>
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
                                   onChange={handleFileChange}
                                   accept="image/png, image/jpeg"
                               />
                            </FormControl>
                            <FormDescription>
                              Accepted formats: PNG, JPEG. Max size: 5MB.
                            </FormDescription>
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
                      
                      <FormField
                        control={profileForm.control}
                        name="university"
                        render={({ field }) => (
                           <FormItem>
                            <FormLabel>University</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger id="university">
                                      <SelectValue placeholder="Select University"/>
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
                    <Save className="mr-2 h-4 w-4"/> {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>

              <Separator className="my-8" />

              {/* --- CHANGE PASSWORD SECTION --- */}
              <div className="space-y-6">
                <div>
                   <h3 className="text-xl font-headline flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/> Change Password</h3>
                   <p className="text-muted-foreground text-sm mt-1">For your security, you will be logged out after changing your password.</p>
                </div>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <div className="relative">
                          <Input id="currentPassword" type={showCurrentPassword ? 'text' : 'password'} {...passwordForm.register('currentPassword')} />
                           <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowCurrentPassword(prev => !prev)}>
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {passwordForm.formState.errors.currentPassword && <p className="text-destructive text-sm">{passwordForm.formState.errors.currentPassword.message}</p>}
                        {passwordState?.errors?.currentPassword && <p className="text-destructive text-sm">{passwordState.errors.currentPassword.join(', ')}</p>}
                     </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} {...passwordForm.register('newPassword')} />
                          <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowNewPassword(prev => !prev)}>
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {passwordForm.formState.errors.newPassword && <p className="text-destructive text-sm">{passwordForm.formState.errors.newPassword.message}</p>}
                        {passwordState?.errors?.newPassword && <p className="text-destructive text-sm">{passwordState.errors.newPassword.join(', ')}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                        <div className="relative">
                          <Input id="confirmNewPassword" type={showConfirmNewPassword ? 'text' : 'password'} {...passwordForm.register('confirmNewPassword')} />
                          <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowConfirmNewPassword(prev => !prev)}>
                              {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {passwordForm.formState.errors.confirmNewPassword && <p className="text-destructive text-sm">{passwordForm.formState.errors.confirmNewPassword.message}</p>}
                      </div>
                       <div className="space-y-1 rounded-md border p-3 shadow-sm">
                            {passwordRequirements.map((req, i) => (
                              <PasswordRequirement key={i} meets={req.meets} label={req.label} />
                            ))}
                        </div>
                     {passwordState?.errors?._form && <p className="text-destructive text-sm">{passwordState.errors._form.join(', ')}</p>}
                     <Button type="submit" variant="secondary" disabled={!passwordForm.formState.isValid || passwordForm.formState.isSubmitting}>
                        <ShieldCheck className="mr-2 h-4 w-4"/> {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                     </Button>
                </form>
              </div>

              <Separator className="my-8" />

              {/* --- DELETE ACCOUNT SECTION --- */}
              <div className="space-y-4">
                  <div>
                      <h3 className="text-xl font-headline flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5"/> Delete Account</h3>
                      <p className="text-muted-foreground text-sm mt-1">Permanently delete your account and all associated data.</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                      Deleting your account? Although we'll miss helping you on your adventures, we do hope you return soon!
                  </p>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={isDeleting}>
                              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deleting...</> : 'Delete My Account'}
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete your account, your profile information, and remove you from any matched trips.
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
